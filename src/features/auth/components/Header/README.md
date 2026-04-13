# Header

## Overview

The site header. Manages Solid authentication UI for both login and logout states.

## Features

| State | Renders |
|---|---|
| Logged out | Provider dropdown (`SOLID_PROVIDERS`), optional custom URL input, login button (disabled until a provider is selected), link to get a Pod |
| Logged in | Display name (resolved via `vcard:fn` or `foaf:name`), logout button, language switcher |
