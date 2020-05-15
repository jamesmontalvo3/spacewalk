<h1 align="center">Maestro</h1>
<h5 align="center">Composing procedures for space operations</h5>

## Purpose

The purpose of Maestro is to replace the manual procedure creation process for Extravehicular Activities (EVAs, AKA "spacewalks") by NASA* personnel. The goal of the application is to be able to write EVA procedures in a simple editor that builds the procedures in a machine- and human-readable format. From there we can generate Word documents in a standardized procedure format, similar to the Space Shuttle mission "STS-134" procedures found on page `FS 7-20` of [this document](https://www.nasa.gov/centers/johnson/pdf/539922main_EVA_134_F_A.pdf). Creating Word documents allows us to fit into the current processes and workflows within NASA, but because the procedures will be machine-readable we'll also be able to generate other formats like web-based, augmented-reality, and more.

<sub>_* This is an independent project and is unaffiliated with NASA_</sub>

## No longer developed here

This project is no longer developed here. It has been brought internal. It is hoped that all internal development will be open sourced at a later time.

## Usage

### Set up the app

1. Install Node.JS
2. Clone this repo
3. Run `npm install` to get dependencies
4. Run `npm run build:electron` to build the JS files
5. Run the Electron app with `npm start`

### Start a Maestro project

You can start your own by going to File🡒New Project, or you can clone the STS-134 procedure:

1. Clone the repo at `https://gitlab.com/xOPERATIONS/sts-134`
2. Navigate to the repo you just cloned using Maestro, and open the `EVA1.yml` file in the `procedures` directory.
