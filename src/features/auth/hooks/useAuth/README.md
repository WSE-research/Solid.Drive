# use Auth

## Overview

Thin wrapper around `useSolidAuth` that exposes the fields most components actually need: `isLoggedIn`, `webId`, `session`, `login(issuerUrl)`, and `logout()`.

## Usage

Most components use this hook instead of calling `useSolidAuth` directly. This makes the intent clearer and helps keep coupling to the LDO library contained.
