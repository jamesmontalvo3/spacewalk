use petgraph::graph::NodeIndex;
use petgraph::Graph;
use std::collections::HashMap;
use std::string::String;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsValue;

mod interval;
pub use interval::Interval;

/// Default uncertainty for the edge between two nodes if the interval is not given
fn default_execution_uncertainty() -> f64 {
    0.1
}

#[wasm_bindgen]
#[derive(Debug, Default, Deserialize, Serialize)]
pub struct RegistrationOptions {
    /// Are distances in the form of [x, x] (keyed by edges[].minutes) instead of [lower, upper]? eg. set to true if edges are in the form of `{ "source": 1, "target": 2, "minutes": 5}`. Set to false if edges are in the form of `{ "source": 1, "target": 2, "interval": [4, 6] }`. Default false
    implicit_intervals: bool,
    /// How much uncertainty should be applied if interval definitions are implicit (see above). Value must be between 0 and 1 inclusive. Defaults to 0.1 (10%)
    #[serde(default = "default_execution_uncertainty")]
    execution_uncertainty: f64,
}

#[wasm_bindgen]
#[derive(Debug, Default, Deserialize, Serialize)]
pub struct RegistrationPayload {
    edges: Vec<Edge>,
}

#[derive(Debug, Default, Deserialize, Serialize)]
pub struct Edge {
    source: i32,
    target: i32,
    #[serde(default)]
    interval: Interval,
    minutes: f64,
}

#[wasm_bindgen]
#[derive(Debug)]
pub struct STN {
    /// maps id to Node in Graph
    node_indices: HashMap<i32, NodeIndex>,
    distance_graph: Graph<i32, f64>,
    /// use ids to key the (column, row) of the constraint table
    constraint_table: HashMap<(i32, i32), f64>,
    // TODO: implement bounds like so?
    bounds: HashMap<i32, Interval>,
}

/// Build the distance graph. Returns (#nodes, #edges) tuple
fn build_distance_graph(
    stn: &mut STN,
    data: &RegistrationPayload,
    options: &RegistrationOptions,
) -> Result<(usize, usize), String> {
    // create nodes first from the edges
    let mut nodes: Vec<i32> = data
        .edges
        .iter()
        .flat_map(|e| vec![e.source, e.target])
        .collect();
    nodes.sort_unstable();
    nodes.dedup();

    for node in nodes.iter() {
        // track the node's bounds
        stn.bounds.insert(*node, Interval::default());
        // add the node to the graph
        let node_index = stn.distance_graph.add_node(*node);
        // track the node_index for later lookups
        stn.node_indices.insert(*node, node_index);
        // create an edge from the node to itself
        // needs to be 0. accounts for the first initialization step in APSP
        stn.distance_graph.add_edge(node_index, node_index, 0.);
    }

    // now set the weights on edges between nodes
    for edge in data.edges.iter() {
        let source = stn.node_indices[&edge.source];
        let target = stn.node_indices[&edge.target];

        let mut lower = edge.interval.lower();
        let mut upper = edge.interval.upper();

        if options.implicit_intervals {
            // apply the uncertainty
            let error_estimate = edge.minutes * options.execution_uncertainty;
            lower = edge.minutes - error_estimate;
            upper = edge.minutes + error_estimate;
        }

        // incoming negative lower interval
        stn.distance_graph.update_edge(target, source, -lower);

        // outgoing upper interval
        stn.distance_graph.update_edge(source, target, upper);
    }

    Ok((
        stn.distance_graph.node_count(),
        stn.distance_graph.edge_count(),
    ))
}

/// Perform All Pairs Shortest Paths algorithm and generate the constraint table
fn perform_apsp(stn: &mut STN) -> Result<(), String> {
    // FYI, we don't need to init. distances from a node to a node (i, i) to 0 because we already set (i, i) edge weights to 0 when we created the graph. The 0s will be added in the loop below

    // add known distances to the table
    for (i, i_node) in stn.node_indices.iter() {
        for (j, j_node) in stn.node_indices.iter() {
            // get the edge index if it exists. if not, this isn't a known distance
            let edge_index = match stn.distance_graph.find_edge(*i_node, *j_node) {
                Some(e) => e,
                None => continue,
            };

            let distance = match stn.distance_graph.edge_weight(edge_index) {
                Some(d) => d,
                None => return Err(format!("missing edge weight: [{}, {}]", i, j)),
            };

            // constraint_table is in (from row, to column) format
            let position = (*i, *j);
            stn.constraint_table.insert(position, *distance);
        }
    }

    let iter = 1_i32..stn.node_indices.len() as i32 + 1;

    // iterate over intermediates
    for k in iter.clone() {
        // i is the row in the constraint table
        for i in iter.clone() {
            // j is the column in the constraint table
            for j in iter.clone() {
                // constraint_table is in (from row, to column) format
                let position = (i, j);
                let d_ik = match stn.constraint_table.get(&(i, k)) {
                    Some(d) => d,
                    None => &std::f64::MAX,
                };
                let d_kj = match stn.constraint_table.get(&(k, j)) {
                    Some(d) => d,
                    None => &std::f64::MAX,
                };

                let d_current = {
                    match stn.constraint_table.get(&position) {
                        Some(d) => d,
                        None => &std::f64::MAX,
                    }
                };

                let d_new = d_current.min(*d_ik + *d_kj);

                if i == j && d_new < 0. {
                    let error_message = format!(
                        "negative cycle found on node ID {}: {} + {} = {}",
                        i, d_ik, d_kj, d_new
                    );
                    return Err(error_message);
                }

                stn.constraint_table.insert(position, d_new);
            }
        }
    }

    Ok(())
}

/// Use the constraint table to set the bounds on each node
fn set_bounds(stn: &mut STN) -> Result<(), String> {
    for i in 1_i32..stn.node_indices.len() as i32 + 1 {
        let d_upper = match stn.constraint_table.get(&(1, i)) {
            Some(d) => d,
            None => {
                return Err(format!(
                    "cannot find distance (1, {}) in constraint table",
                    i
                ))
            }
        };

        let d_lower = match stn.constraint_table.get(&(i, 1)) {
            Some(d) => -d,
            None => {
                return Err(format!(
                    "cannot find distance ({}, 1) in constraint table",
                    i
                ))
            }
        };

        stn.bounds.insert(i, Interval::new(d_lower, *d_upper));
    }

    Ok(())
}

/// Initialize the STN using APSP set activity bounds
fn initialize(
    stn: &mut STN,
    data: &RegistrationPayload,
    options: &RegistrationOptions,
) -> Result<(usize, usize), String> {
    let res = build_distance_graph(stn, &data, &options)?;
    perform_apsp(stn)?;
    set_bounds(stn)?;
    Ok(res)
}

/// Commit an as-performed time to the STN. Updates bounds on remaining activities. Errs if the as_performed time creates a conflict
fn commit_and_tighten(stn: &mut STN, node_id: i32, as_performed: f64) -> Result<(), String> {
    let b = match stn.bounds.get(&node_id) {
        Some(b) => b,
        None => return Err(format!("cannot find bounds for node_id {}", node_id)),
    };

    if !b.contains(as_performed) {
        return Err(format!(
            "as_performed value {} for node ID {} is not in bounds {}",
            as_performed, node_id, b
        ));
    }

    let b_as_performed = Interval::new(as_performed, as_performed);

    // assign the as_performed bounds
    stn.bounds.insert(node_id, b_as_performed);

    let iter = 1_i32..stn.node_indices.len() as i32 + 1;

    // update all the neighbor bounds
    for i in iter {
        // no need to tighten self
        if i == node_id {
            continue;
        }

        // get the neighbor's current bounds
        let b_i = stn.bounds[&i];

        // get the interval to the neighbor according to the constraint table
        let lower = stn.constraint_table[&(i, node_id)];
        let upper = stn.constraint_table[&(node_id, i)];
        let interval_to_neighbor = Interval::new(-lower, upper);

        // actually update the bounds on the neighbor
        let updated_bounds = b_i & (b_as_performed + interval_to_neighbor);
        stn.bounds.insert(i, updated_bounds);
    }

    Ok(())
}

/// (node count, edge count) tuple struct
#[wasm_bindgen]
pub struct RegistrationEnum(usize, usize);

#[wasm_bindgen]
impl STN {
    #[wasm_bindgen(constructor)]
    pub fn new() -> STN {
        STN {
            bounds: HashMap::new(),
            node_indices: HashMap::new(),
            distance_graph: Graph::new(),
            constraint_table: HashMap::new(),
        }
    }

    /// Initialize the STN
    pub fn initialize(
        &mut self,
        payload: &JsValue,
        options: &JsValue,
    ) -> Result<RegistrationEnum, JsValue> {
        let data: RegistrationPayload = payload.into_serde().unwrap();
        let options: RegistrationOptions = options.into_serde().unwrap();

        match initialize(self, &data, &options) {
            Ok((nodes, edges)) => Ok(RegistrationEnum(nodes, edges)),
            Err(e) => Err(JsValue::from_str(&e)),
        }
    }

    #[wasm_bindgen(js_name = toString)]
    pub fn to_string(&self) -> String {
        format!("{} nodes, {} edges", self.node_indices.len(), self.distance_graph.edge_count())
    }

    /// Commit an as-performed time and update bounds
    #[wasm_bindgen(catch, method, js_name = commitAndTighten)]
    pub fn commit_and_tighten(&mut self, node_id: i32, as_performed: f64) -> Result<(), JsValue> {
        match commit_and_tighten(self, node_id, as_performed) {
            Ok(()) => Ok(()),
            Err(e) => Err(JsValue::from_str(&e)),
        }
    }
}

// TODO: code:test ratio is 1:2. move tests into a separate file?

#[cfg(test)]
mod tests {
    extern crate wasm_bindgen_test;
    use super::*;
    use serde_json::json;
    use wasm_bindgen_test::*;

    #[test]
    fn test_build_distance_graph_empty_input() -> Result<(), String> {
        let payload = RegistrationPayload { edges: vec![] };
        let options = RegistrationOptions {
            implicit_intervals: true,
            execution_uncertainty: 0.,
        };

        let mut stn = STN::new();

        let res = build_distance_graph(&mut stn, &payload, &options)?;
        assert_eq!(
            (0_usize, 0_usize),
            res,
            "no nodes or edges should be created"
        );

        Ok(())
    }

    #[test]
    fn test_build_distance_graph_walkthrough_graph() -> Result<(), String> {
        // define the graph from the walkthrough
        let edges = vec![
            Edge {
                source: 1,
                target: 2,
                interval: Interval::new(10., 20.),
                minutes: 0.,
            },
            Edge {
                source: 2,
                target: 3,
                interval: Interval::new(30., 40.),
                minutes: 0.,
            },
            Edge {
                source: 4,
                target: 3,
                interval: Interval::new(10., 20.),
                minutes: 0.,
            },
            Edge {
                source: 4,
                target: 5,
                interval: Interval::new(40., 50.),
                minutes: 0.,
            },
            Edge {
                source: 1,
                target: 5,
                interval: Interval::new(60., 70.),
                minutes: 0.,
            },
        ];

        let data = RegistrationPayload { edges: edges };

        let options = RegistrationOptions {
            implicit_intervals: false,
            execution_uncertainty: 0.,
        };

        let mut stn = STN::new();
        let (nodes_created, edges_created) = build_distance_graph(&mut stn, &data, &options)?;

        // just check that the graph was built
        assert_eq!(5_usize, nodes_created, "correct number of nodes created");
        assert_eq!(15_usize, edges_created, "correct number of edges created");

        // now make sure edge weights are correct
        struct Case {
            from: i32,
            to: i32,
            interval: Interval,
        }

        let cases = vec![
            Case {
                from: 1,
                to: 2,
                interval: Interval::new(10., 20.),
            },
            Case {
                from: 2,
                to: 3,
                interval: Interval::new(30., 40.),
            },
            Case {
                from: 4,
                to: 3,
                interval: Interval::new(10., 20.),
            },
            Case {
                from: 4,
                to: 5,
                interval: Interval::new(40., 50.),
            },
            Case {
                from: 1,
                to: 5,
                interval: Interval::new(60., 70.),
            },
        ];

        for c in cases.iter() {
            let from = {
                match stn.node_indices.get(&c.from) {
                    Some(n) => n,
                    None => panic!("could not find node index {}", c.from),
                }
            };
            let to = {
                match stn.node_indices.get(&c.to) {
                    Some(n) => n,
                    None => panic!("could not find index {}", c.to),
                }
            };
            let edge_to = {
                match stn.distance_graph.find_edge(*from, *to) {
                    Some(edge) => edge,
                    None => panic!("could not find edge indices ({} - {})", c.from, c.to),
                }
            };
            let weight_to = {
                match stn.distance_graph.edge_weight(edge_to) {
                    Some(w) => w,
                    None => panic!(
                        "could not find weight between indices ({} - {})",
                        c.from, c.to
                    ),
                }
            };
            assert_eq!(
                c.interval.upper(),
                *weight_to,
                "({} - {}) = {}",
                c.from,
                c.to,
                c.interval.upper()
            );

            let edge_from = {
                match stn.distance_graph.find_edge(*to, *from) {
                    Some(edge) => edge,
                    None => panic!("could not find edge indices ({} - {})", c.from, c.to),
                }
            };
            let weight_from = {
                match stn.distance_graph.edge_weight(edge_from) {
                    Some(w) => w,
                    None => panic!(
                        "could not find weight between indices ({} - {})",
                        c.from, c.to
                    ),
                }
            };
            assert_eq!(
                -c.interval.lower(),
                *weight_from,
                "({} - {}) = {}",
                c.to,
                c.from,
                -c.interval.lower()
            );
        }

        Ok(())
    }
    #[test]
    fn test_build_distance_graph_implicit_intervals() -> Result<(), String> {
        // define the graph from the walkthrough
        let edges = vec![
            Edge {
                source: 1,
                target: 2,
                interval: Interval::default(),
                minutes: 10.,
            },
            Edge {
                source: 2,
                target: 3,
                interval: Interval::default(),
                minutes: 20.,
            },
            Edge {
                source: 4,
                target: 3,
                interval: Interval::default(),
                minutes: 30.,
            },
            Edge {
                source: 4,
                target: 5,
                interval: Interval::default(),
                minutes: 40.,
            },
            Edge {
                source: 1,
                target: 5,
                interval: Interval::default(),
                minutes: 50.,
            },
        ];

        let data = RegistrationPayload { edges: edges };

        let options = RegistrationOptions {
            implicit_intervals: true,
            execution_uncertainty: 0.1,
        };

        let mut stn = STN::new();
        let (nodes_created, edges_created) = build_distance_graph(&mut stn, &data, &options)?;

        // just check that the graph was built
        assert_eq!(5_usize, nodes_created, "correct number of nodes created");
        assert_eq!(15_usize, edges_created, "correct number of edges created");

        // now make sure edge weights are correct
        struct Case {
            from: i32,
            to: i32,
            interval: Interval,
        }

        let cases = vec![
            Case {
                from: 1,
                to: 2,
                interval: Interval::new(9., 11.),
            },
            Case {
                from: 2,
                to: 3,
                interval: Interval::new(18., 22.),
            },
            Case {
                from: 4,
                to: 3,
                interval: Interval::new(27., 33.),
            },
            Case {
                from: 4,
                to: 5,
                interval: Interval::new(36., 44.),
            },
            Case {
                from: 1,
                to: 5,
                interval: Interval::new(45., 55.),
            },
        ];

        for c in cases.iter() {
            let from = {
                match stn.node_indices.get(&c.from) {
                    Some(n) => n,
                    None => panic!("could not find node index {}", c.from),
                }
            };
            let to = {
                match stn.node_indices.get(&c.to) {
                    Some(n) => n,
                    None => panic!("could not find index {}", c.to),
                }
            };
            let edge_to = {
                match stn.distance_graph.find_edge(*from, *to) {
                    Some(edge) => edge,
                    None => panic!("could not find edge indices ({} - {})", c.from, c.to),
                }
            };
            let weight_to = {
                match stn.distance_graph.edge_weight(edge_to) {
                    Some(w) => w,
                    None => panic!(
                        "could not find weight between indices ({} - {})",
                        c.from, c.to
                    ),
                }
            };
            assert_eq!(
                c.interval.upper(),
                *weight_to,
                "({} - {}) = {}",
                c.from,
                c.to,
                c.interval.upper()
            );

            let edge_from = {
                match stn.distance_graph.find_edge(*to, *from) {
                    Some(edge) => edge,
                    None => panic!("could not find edge indices ({} - {})", c.from, c.to),
                }
            };
            let weight_from = {
                match stn.distance_graph.edge_weight(edge_from) {
                    Some(w) => w,
                    None => panic!(
                        "could not find weight between indices ({} - {})",
                        c.from, c.to
                    ),
                }
            };
            assert_eq!(
                -c.interval.lower(),
                *weight_from,
                "({} - {}) = {}",
                c.to,
                c.from,
                -c.interval.lower()
            );
        }

        // make sure (i, i) weights are 0
        for i in 1..6 {
            let node_index = {
                match stn.node_indices.get(&i) {
                    Some(n) => n,
                    None => panic!("could not find index {}", i),
                }
            };
            let edge = {
                match stn.distance_graph.find_edge(*node_index, *node_index) {
                    Some(edge) => edge,
                    None => panic!("could not find edge indices ({} - {})", i, i),
                }
            };
            let weight = {
                match stn.distance_graph.edge_weight(edge) {
                    Some(w) => w,
                    None => panic!("could not find weight between indices ({} - {})", i, i),
                }
            };
            assert_eq!(0., *weight, "({} - {}) = 0 got {}", i, i, *weight);
        }

        Ok(())
    }

    #[wasm_bindgen_test]
    fn test_register_graph_converts_json_no_nodes() {
        let payload = {
            match JsValue::from_serde(&json!(
              {
                "nodes": [],
                "edges": [],
              }
            )) {
                Ok(p) => p,
                Err(e) => panic!("could not create payload | {:?}", e),
            }
        };

        let options = {
            match JsValue::from_serde(&json!(
              { "implicit_intervals": true }
            )) {
                Ok(p) => p,
                Err(e) => panic!("could not create payload | {:?}", e),
            }
        };

        let mut stn = STN::new();
        match stn.initialize(&payload, &options) {
            Ok(u) => assert_eq!(
                (0_usize, 0_usize),
                (u.0, u.1),
                "No nodes or edges expected to be made"
            ),
            Err(e) => panic!("failed running stn.register_graph | {:?}", e),
        }
    }

    #[wasm_bindgen_test]
    fn test_register_graph_converts_json_two_nodes_two_edges() {
        let input = json!(
          {
            "edges": [{"minutes": 60, "source": 0, "target": 1}],
          }
        );

        let mut stn = STN::new();

        let payload = {
            match JsValue::from_serde(&input) {
                Ok(p) => p,
                Err(e) => panic!("could not create payload | {:?}", e),
            }
        };

        let options = {
            match JsValue::from_serde(&json!(
              { "implicit_intervals": true }
            )) {
                Ok(p) => p,
                Err(e) => panic!("could not create payload | {:?}", e),
            }
        };

        match stn.initialize(&payload, &options) {
            Ok(u) => assert_eq!(
                (2_usize, 4_usize),
                (u.0, u.1),
                "Two nodes, 4 edges expected to be made"
            ),
            Err(e) => panic!("failed running stn.register_graph | {:?}", e),
        }
    }

    #[test]
    fn test_perform_apsp_against_walkthrough_data() -> Result<(), String> {
        // define the graph from the walkthrough
        let edges = vec![
            Edge {
                source: 1,
                target: 2,
                interval: Interval::new(10., 20.),
                minutes: 0.,
            },
            Edge {
                source: 2,
                target: 3,
                interval: Interval::new(30., 40.),
                minutes: 0.,
            },
            Edge {
                source: 4,
                target: 3,
                interval: Interval::new(10., 20.),
                minutes: 0.,
            },
            Edge {
                source: 4,
                target: 5,
                interval: Interval::new(40., 50.),
                minutes: 0.,
            },
            Edge {
                source: 1,
                target: 5,
                interval: Interval::new(60., 70.),
                minutes: 0.,
            },
        ];

        let data = RegistrationPayload { edges: edges };

        let options = RegistrationOptions {
            implicit_intervals: false,
            execution_uncertainty: 0.,
        };

        let mut stn = STN::new();
        build_distance_graph(&mut stn, &data, &options)?;
        perform_apsp(&mut stn)?;

        // full STN with implicit constraints from the walkthrough example
        // ((from, to), distance)
        let expected_constraint_table: HashMap<(i32, i32), f64> = [
            ((1, 1), 0.),
            ((1, 2), 20.),
            ((1, 3), 50.),
            ((1, 4), 30.),
            ((1, 5), 70.),
            ((2, 1), -10.),
            ((2, 2), 0.),
            ((2, 3), 40.),
            ((2, 4), 20.),
            ((2, 5), 60.),
            ((3, 1), -40.),
            ((3, 2), -30.),
            ((3, 3), 0.),
            ((3, 4), -10.),
            ((3, 5), 30.),
            ((4, 1), -20.),
            ((4, 2), -10.),
            ((4, 3), 20.),
            ((4, 4), 0.),
            ((4, 5), 50.),
            ((5, 1), -60.),
            ((5, 2), -50.),
            ((5, 3), -20.),
            ((5, 4), -40.),
            ((5, 5), 0.),
        ]
        .iter()
        .cloned()
        .collect();

        assert_eq!(
            expected_constraint_table.len(),
            stn.constraint_table.len(),
            "constraint tables are the same size"
        );

        for (i, dist) in expected_constraint_table.iter() {
            assert_eq!(
                *dist, stn.constraint_table[i],
                "{:?} want {}, got {}",
                i, *dist, stn.constraint_table[i],
            )
        }

        Ok(())
    }

    #[test]
    fn test_set_bounds_walkthrough_data() -> Result<(), String> {
        // define the graph from the walkthrough
        let edges = vec![
            Edge {
                source: 1,
                target: 2,
                interval: Interval::new(10., 20.),
                minutes: 0.,
            },
            Edge {
                source: 2,
                target: 3,
                interval: Interval::new(30., 40.),
                minutes: 0.,
            },
            Edge {
                source: 4,
                target: 3,
                interval: Interval::new(10., 20.),
                minutes: 0.,
            },
            Edge {
                source: 4,
                target: 5,
                interval: Interval::new(40., 50.),
                minutes: 0.,
            },
            Edge {
                source: 1,
                target: 5,
                interval: Interval::new(60., 70.),
                minutes: 0.,
            },
        ];

        let data = RegistrationPayload { edges: edges };

        let options = RegistrationOptions {
            implicit_intervals: false,
            execution_uncertainty: 0.,
        };

        let mut stn = STN::new();
        build_distance_graph(&mut stn, &data, &options)?;
        perform_apsp(&mut stn)?;
        set_bounds(&mut stn)?;

        let expected_bounds: HashMap<i32, Interval> = [
            (1, Interval::new(0., 0.)),
            (2, Interval::new(10., 20.)),
            (3, Interval::new(40., 50.)),
            (4, Interval::new(20., 30.)),
            (5, Interval::new(60., 70.)),
        ]
        .iter()
        .cloned()
        .collect();

        assert_eq!(
            expected_bounds.len(),
            stn.bounds.len(),
            "bounds are the same size"
        );

        for (i, b) in expected_bounds.iter() {
            assert_eq!(
                *b, stn.bounds[i],
                "{:?} want {}, got {}",
                i, *b, stn.bounds[i],
            )
        }

        Ok(())
    }

    #[test]
    fn test_commit_and_tighten_walkthrough_data() -> Result<(), String> {
        // define the graph from the walkthrough
        let edges = vec![
            Edge {
                source: 1,
                target: 2,
                interval: Interval::new(10., 20.),
                minutes: 0.,
            },
            Edge {
                source: 2,
                target: 3,
                interval: Interval::new(30., 40.),
                minutes: 0.,
            },
            Edge {
                source: 4,
                target: 3,
                interval: Interval::new(10., 20.),
                minutes: 0.,
            },
            Edge {
                source: 4,
                target: 5,
                interval: Interval::new(40., 50.),
                minutes: 0.,
            },
            Edge {
                source: 1,
                target: 5,
                interval: Interval::new(60., 70.),
                minutes: 0.,
            },
        ];

        let data = RegistrationPayload { edges: edges };

        let options = RegistrationOptions {
            implicit_intervals: false,
            execution_uncertainty: 0.,
        };

        let mut stn = STN::new();
        build_distance_graph(&mut stn, &data, &options)?;
        perform_apsp(&mut stn)?;
        set_bounds(&mut stn)?;

        // test what happens after the first activity is set to 0
        commit_and_tighten(&mut stn, 1, 0.)?;

        let expected_bounds: HashMap<i32, Interval> = [
            (1, Interval::new(0., 0.)),
            (2, Interval::new(10., 20.)),
            (3, Interval::new(40., 50.)),
            (4, Interval::new(20., 30.)),
            (5, Interval::new(60., 70.)),
        ]
        .iter()
        .cloned()
        .collect();

        for (i, b) in expected_bounds.iter() {
            assert_eq!(
                *b, stn.bounds[i],
                "{:?} want {}, got {}",
                i, *b, stn.bounds[i],
            )
        }

        // test what happens when the second activity is set to 15
        commit_and_tighten(&mut stn, 2, 15.)?;

        let expected_bounds: HashMap<i32, Interval> = [
            (1, Interval::new(0., 0.)),
            (2, Interval::new(15., 15.)),
            (3, Interval::new(45., 50.)),
            (4, Interval::new(25., 30.)),
            (5, Interval::new(65., 70.)),
        ]
        .iter()
        .cloned()
        .collect();

        for (i, b) in expected_bounds.iter() {
            assert_eq!(
                *b, stn.bounds[i],
                "{:?} want {}, got {}",
                i, *b, stn.bounds[i],
            )
        }

        // test what happens when the third activity is set to 46
        commit_and_tighten(&mut stn, 3, 46.)?;

        let expected_bounds: HashMap<i32, Interval> = [
            (1, Interval::new(0., 0.)),
            (2, Interval::new(15., 15.)),
            (3, Interval::new(46., 46.)),
            (4, Interval::new(26., 30.)),
            (5, Interval::new(66., 70.)),
        ]
        .iter()
        .cloned()
        .collect();

        for (i, b) in expected_bounds.iter() {
            assert_eq!(
                *b, stn.bounds[i],
                "{:?} want {}, got {}",
                i, *b, stn.bounds[i],
            )
        }

        Ok(())
    }
}
