# Contacts List

## Overview

Lists the user's contacts (from `foaf:knows`) and provides an input for adding new ones. WebID input is validated to be a valid `http(s)://` URL before calling `addContact`.

## Features

| Feature | Description |
|---|---|
| Rejection notifications | Rejection notifications from the owner's inbox are loaded on mount and displayed in each `ContactRow` |
| Clearing rejections | Clearing a rejection removes it from the local map; it is not deleted from the inbox until the user explicitly requests access again |
