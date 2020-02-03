use serde_json::json;
use std::default::Default;
use std::fmt::{self, Display, Formatter};
use std::ops::{Add, AddAssign, BitAnd, BitAndAssign, Neg, Sub, SubAssign};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[derive(Deserialize, Serialize, Copy, Clone, Debug, PartialEq, Default)]
pub struct Interval(f64, f64);

#[wasm_bindgen]
impl Interval {
    /// Create a new Interval
    #[wasm_bindgen(constructor)]
    pub fn new(lower: f64, upper: f64) -> Interval {
        Interval(lower, upper)
    }

    #[wasm_bindgen(js_name = toString)]
    pub fn to_string(&self) -> String {
        format!("[{}, {}]", self.0, self.1)
    }

    #[wasm_bindgen(js_name = toJSON)]
    pub fn to_json(&self) -> JsValue {
        let value = json!([self.0, self.1]);
        JsValue::from_serde(&value).unwrap()
    }

    #[wasm_bindgen]
    pub fn lower(&self) -> f64 {
        self.0
    }

    #[wasm_bindgen]
    pub fn upper(&self) -> f64 {
        self.1
    }

    #[wasm_bindgen]
    pub fn contains(&self, v: f64) -> bool {
        v >= self.lower() && v <= self.upper()
    }

    #[wasm_bindgen(js_name = isValid)]
    pub fn is_valid(&self) -> bool {
        self.lower() <= self.upper()
    }
}

impl Display for Interval {
    fn fmt(&self, f: &mut Formatter) -> fmt::Result {
        // `f` is a buffer, and this method must write the formatted string into it
        // `write!` is like `format!`, but it will write the formatted string
        // into a buffer (the first argument)
        write!(f, "[{}, {}]", self.0, self.1)
    }
}

// [l_1, u_1] + [l_2, u_2] = [l_1 + l_2, u_1 + u_2]
impl Add for Interval {
    type Output = Interval;

    fn add(self, other: Interval) -> Interval {
        Interval(self.0 + other.0, self.1 + other.1)
    }
}

// [l_1, u_1] += [l_2, u_2] == [l_1 + l_2, u_1 + u_2]
impl AddAssign for Interval {
    fn add_assign(&mut self, other: Interval) {
        *self = Interval(self.0 + other.0, self.1 + other.1)
    }
}

// -[l_1, u_1] = [-u_1, -l_1]
impl Neg for Interval {
    type Output = Interval;

    fn neg(self) -> Interval {
        Interval(-self.1, -self.0)
    }
}

// [l_1, u_1] - [l_2, u_2] = [l_1, u_1] + [-u_2, -l_2] = [l_1 - u_2, u_1 - l_2]
impl Sub for Interval {
    type Output = Interval;

    fn sub(self, other: Interval) -> Interval {
        self + -other
    }
}

// [l_1, u_1] -= [l_2, u_2] = [l_1, u_1] + [-u_2, -l_2] = [l_1 - u_2, u_1 - l_2]
impl SubAssign for Interval {
    fn sub_assign(&mut self, other: Interval) {
        *self = *self + -other
    }
}

// l_1, u_1] & [l_2, u_2] = [\max(l_1, l_2), \min(u_1, u_2)]
impl BitAnd for Interval {
    type Output = Interval;

    fn bitand(self, other: Interval) -> Interval {
        Interval(self.0.max(other.0), self.1.min(other.1))
    }
}

// l_1, u_1] &= [l_2, u_2] = [\max(l_1, l_2), \min(u_1, u_2)]
impl BitAndAssign for Interval {
    fn bitand_assign(&mut self, other: Interval) {
        *self = Interval(self.0.max(other.0), self.1.min(other.1))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_interval_add() {
        struct Case {
            in1: Interval,
            in2: Interval,
            out: Interval,
        }

        let cases = vec![
            Case {
                in1: Interval(1., 1.),
                in2: Interval(2., 2.),
                out: Interval(3., 3.),
            },
            Case {
                in1: Interval(0., 0.),
                in2: Interval(2., 2.),
                out: Interval(2., 2.),
            },
            Case {
                in1: Interval(1.5, 1.5),
                in2: Interval(2., 2.),
                out: Interval(3.5, 3.5),
            },
        ];

        for case in cases.iter() {
            let res = case.in1 + case.in2;

            assert_eq!(case.out, res, "{} + {} == {}", case.in1, case.in2, case.out);
        }
    }

    #[test]
    fn test_interval_add_assign() {
        struct Case {
            in1: Interval,
            in2: Interval,
            out: Interval,
        }

        let mut cases = vec![
            Case {
                in1: Interval(1., 1.),
                in2: Interval(2., 2.),
                out: Interval(3., 3.),
            },
            Case {
                in1: Interval(0., 0.),
                in2: Interval(2., 2.),
                out: Interval(2., 2.),
            },
            Case {
                in1: Interval(1.5, 1.5),
                in2: Interval(2., 2.),
                out: Interval(3.5, 3.5),
            },
        ];

        for case in cases.iter_mut() {
            case.in1 += case.in2;

            assert_eq!(
                case.out, case.in1,
                "{} += {} == {}",
                case.in1, case.in2, case.out
            );
        }
    }

    #[test]
    fn test_interval_sub() {
        struct Case {
            in1: Interval,
            in2: Interval,
            out: Interval,
        }

        let cases = vec![
            Case {
                in1: Interval(2., 2.),
                in2: Interval(1., 1.),
                out: Interval(1., 1.),
            },
            Case {
                in1: Interval(2., 2.),
                in2: Interval(2., 2.),
                out: Interval(0., 0.),
            },
            Case {
                in1: Interval(2., 2.),
                in2: Interval(1.5, 1.5),
                out: Interval(0.5, 0.5),
            },
        ];

        for case in cases.iter() {
            let res = case.in1 - case.in2;

            assert_eq!(case.out, res, "{} - {} == {}", case.in1, case.in2, case.out);
        }
    }

    #[test]
    fn test_interval_sub_assign() {
        struct Case {
            in1: Interval,
            in2: Interval,
            out: Interval,
        }

        let mut cases = vec![
            Case {
                in1: Interval(2., 2.),
                in2: Interval(1., 1.),
                out: Interval(1., 1.),
            },
            Case {
                in1: Interval(2., 2.),
                in2: Interval(2., 2.),
                out: Interval(0., 0.),
            },
            Case {
                in1: Interval(2., 2.),
                in2: Interval(1.5, 1.5),
                out: Interval(0.5, 0.5),
            },
        ];

        for case in cases.iter_mut() {
            case.in1 -= case.in2;

            assert_eq!(
                case.out, case.in1,
                "{} -= {} == {}",
                case.in1, case.in2, case.out
            );
        }
    }

    #[test]
    fn test_interval_union() {
        struct Case {
            in1: Interval,
            in2: Interval,
            out: Interval,
        }

        let cases = vec![
            Case {
                in1: Interval(1., 3.),
                in2: Interval(2., 4.),
                out: Interval(2., 3.),
            },
            Case {
                in1: Interval(0., 10.1),
                in2: Interval(1., 12.),
                out: Interval(1., 10.1),
            },
        ];

        for case in cases.iter() {
            let res = case.in1 & case.in2;

            assert_eq!(case.out, res, "{} ^ {} == {}", case.in1, case.in2, case.out);
        }
    }

    #[test]
    fn test_interval_union_assign() {
        struct Case {
            in1: Interval,
            in2: Interval,
            out: Interval,
        }

        let mut cases = vec![
            Case {
                in1: Interval(1., 3.),
                in2: Interval(2., 4.),
                out: Interval(2., 3.),
            },
            Case {
                in1: Interval(0., 10.1),
                in2: Interval(1., 12.),
                out: Interval(1., 10.1),
            },
        ];

        for case in cases.iter_mut() {
            case.in1 &= case.in2;

            assert_eq!(
                case.out, case.in1,
                "{} ^= {} == {}",
                case.in1, case.in2, case.out
            );
        }
    }

    #[test]
    fn test_mixed_operators() {
        let i1 = Interval::new(40., 50.);
        let i2 = Interval::new(15., 15.);
        let i3 = Interval::new(30., 40.);

        let res = i1 & (i2 + i3);
        assert_eq!(
            res,
            Interval::new(45., 50.),
            "interval math from scheduling walkthrough"
        );
    }
}
