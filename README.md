<h1 align="center">Maestro</h1>

<h5 align="center">Composing procedures for space operations</h5>

<div align="center">
  <a href="https://travis-ci.org/xoperations/maestro">
    <img src="https://travis-ci.org/xoperations/maestro.svg?branch=master" alt="Travis CI" />
  </a>
  <a href="https://codeclimate.com/github/xOPERATIONS/maestro/maintainability">
    <img src="https://api.codeclimate.com/v1/badges/b5bf9f5a0208eb91bf53/maintainability" alt="Maintainability" />
  </a>
  <a href="https://codeclimate.com/github/xOPERATIONS/maestro/test_coverage">
    <img src="https://api.codeclimate.com/v1/badges/b5bf9f5a0208eb91bf53/test_coverage" alt="Test Coverage" />
  </a>

  <br />
  <img src="docs/maestro-command.gif" alt="maestro in terminal" />

</div>

<br />

## Purpose

The purpose of Maestro is to replace the manual procedure creation process for Extravehicular Activities (EVAs, AKA "spacewalks") by NASA* personnel. The goal of the application is to be able to write EVA procedures as simple YAML files and run `maestro compose` to generate Word or other documents in a standardized procedure format, similar to the Space Shuttle mission "STS-134" procedures found on page `FS 7-20` of [this document](https://www.nasa.gov/centers/johnson/pdf/539922main_EVA_134_F_A.pdf). More EVAs can be found at the [FOIA archive](https://www.nasa.gov/centers/johnson/news/flightdatafiles/foia_archive.html).

<sub>_* This is an independent project and is unaffiliated with NASA_</sub>

## Usage

The `maestro compose` command can be used within a valid Maestro project, such as those listed in the "examples" section below. A Maestro project consists of at least:

1. A `procedures` directory containing at least one `.yml` file defining a procedure
2. A `tasks` directory containing the task `.yml` files defined within the procedure file

Running `maestro compose` will generate an MS Word DOCX procedure file that looks something like this:

![image](docs/docx-example.png)

Other formats are also available:

- `maestro compose --no-eva-docx` prevents generating the default multi-column (EVA) format
- `maestro compose --sodf` generates a more serial version of the procedure
- `maestro compose --html` generates an HTML version of the EVA format
- Future output will support domain-specific formats

### Serving HTML

Ultimately Maestro will include a web application for composing and conducting procedures. For now,
simply viewing the HTML versions of procedures can be achieved by doing:

```bash
maestro compose --html           # This generates HTML versions of procedures
maestro conduct
```

To specify port, do `maestro conduct --port=8080`.

## Examples

- Maestro generating STS-134 procedures using GitLab CI: https://gitlab.com/xOPERATIONS/sts-134

## Installation

Maestro is under heavy development. While it's possible to `npm install -g xops-pat` the versions within NPM may be out of date. It's better to do the following:

### Install for dev purposes

1. Install Node.JS
2. Clone this repo, then run `npm install` within it
3. Setup the `maestro` command by doing `npm link`
4. Test it out on a Maestro project

#### If you're using the web output

We're experimenting with Rust to build WASM modules for faster math. To output the web (HTML) version you'll need to install the Rust toolchain and run an additional build command.

1. Install [`cargo` + `rustc`](https://doc.rust-lang.org/cargo/getting-started/installation.html)
2. When building the app, run `npm build && npm link` instead of just `npm link`.

Everything else is the same.

### VS Code

If you use [VS Code](https://code.visualstudio.com/), we recommend installing the [eslint extension](https://github.com/microsoft/vscode-eslint) to see linting messages in your editor as you work. You'll also get automatic formatting to fix common mistakes.

## Goals

1. Procedures can represent multiple actors performing actions in parallel
2. An output format has to look pretty close to current EVA procedures (otherwise it will be too hard to force a culture change within the community).
3. Procedure authors should not need to worry about formatting at all (the system enforces standards)
4. Procedure authors should be able to easily receive changes from contributors and accept, reject, or request updates
5. Procedure authors should be able to easily diff changes between arbitrary versions of procedures
6. Editing a procedure should be as easy as editing one in MS Word. On face value this seems like a difficult requirement, but in reality formatting hardships with Word are a big driver for finding a better solution. Editing the raw YAML files is doable and preferable for some users, but for those

## Issue and feature tracking

Issues in this repository will only be kept open for either (1) unresolved bugs or (2) other items being legitimately worked as part of an [active project](https://github.com/xOPERATIONS/maestro/projects). "Legitimately being worked" means the issue is in the "priority" column or further. Items in the backlog will be left in the "closed" state in order to keep the list of all issues clean, thus focusing on high-priority items (e.g. actual bugs and in-work items).

When these incomplete-but-closed issues begin being worked, they will be reopened. When they are completed they will be closed and their labels will be updated accordingly (e.g. `feature request` becomes `feature added!` and `debt cleanup` becomes `debt paid!`).

### New non-bugs are immediately closed

New non-priority issues will be labelled accordingly and closed immediately (unless they will be immediately worked) with one of the following comments:

- Feature requests: `Feature requests closed until legitimately close to consideration for implementation. See [the list of pending feature requests](https://github.com/xOPERATIONS/maestro/issues?q=is%3Aclosed+is%3Aissue+label%3A%22feature+request%22)`
- Debt cleanup: `Debt cleanup issues closed until legitimately close to consideration for implementation. See [the list of pending debt cleanup](https://github.com/xOPERATIONS/maestro/issues?q=is%3Aclosed+is%3Aissue+label%3A%22debt+cleanup%22)`

### Lists of deferred feature requests and debt cleanup

The following lists include possible future issues to work, but are not currently being worked and thus are not given the priority of being shown open.

- [Feature requests](https://github.com/xOPERATIONS/maestro/issues?q=is%3Aclosed+is%3Aissue+label%3A%22feature+request%22)
- [Debt cleanup](https://github.com/xOPERATIONS/maestro/issues?q=is%3Aclosed+is%3Aissue+label%3A%22debt+cleanup%22)


## Definitions

Maestro uses several terms like "actors", "roles", and "tasks". These need better definition.

## Videos

Old videos exist [here](https://www.youtube.com/watch?v=l8NPJTH6QzU), [here](https://www.youtube.com/watch?v=G60tPv9cM08), and [here](https://www.youtube.com/watch?v=uTopcel6VpA). These are probably out of date. New ones coming soon.

## API Reference

Build API docs into the `.api-docs` directory by running `./node_modules/jsdoc/jsdoc.js -c ./.jsdoc.json .`. At the time of this writing the docs are pretty minimal and poorly linked, but will hopefully improve with time.

See [YAML Definition](docs/yamlDefinition.md) for an overview of YAML file syntax. This link also provides details on how NASA JSC writes procedures in the YAML files format for EVA Tasks and how the EVA Task Generator uses the data dictionary to parse YAML files.

## Tests

```sh
npm t
```

### Puppeteer

This repo uses [puppeteer](https://github.com/puppeteer/puppeteer) to perform snapshot testing. Installing Puppeteer (as part of `npm i`) will automatically handle downloading Chromium to perform the actual rendering.

#### Red Hat Enterprise Linux 7 Troubleshooting

If you're on RHEL 7, you may run into "No usable sandbox!" errors. If so, follow the instructions [here](https://github.com/puppeteer/puppeteer/blob/master/docs/troubleshooting.md#alternative-setup-setuid-sandbox) to move a sandbox executable to a location on your `$PATH`.

### Unit Testing & linting

A pre-commit hook is in place forcing linting, style, and unit testing to all pass prior to making commits.

## Credits

### Project Sponsor

James Montalvo

### UMUC Phase III Development Team, Fall 2019

TBD

### UMUC Phase II Development Team, Spring 2019

- Akruthi Shetty
- Christopher Redding
- Ebony Christian
- Joe Bidinger
- Ted Deloggio

### UMUC Phase I Development Team, Fall 2018

- Jose De la Cruz
- Jason Foley
- Alexandra Kuntz
- Engedawork Befekadu
- Timothy Smith
- Christopher Drury
- Kevin Terry
- John-Carlo Babin
