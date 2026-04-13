# Contact Row

## Overview

A single row in the contacts list. Loads the contact's Solid profile to show their name and avatar.

## Features

| Feature | Description |
|---|---|
| Request access | Sends a catalog access request to the contact's LDP inbox so they can share their files with you |
| Remove | Deletes the `foaf:knows` triple from the owner's profile |
| Rejection state | If a rejection exists for this contact (passed in as a prop), the request button is replaced with a "Denied" label and a "Request again" button that retries after deleting the old rejection message |
