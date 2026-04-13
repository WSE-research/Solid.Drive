# profile

## Overview

Everything related to user profile management and social connections.

## Contents

| Name | Description |
|---|---|
| **components/ProfileSidebar** | The sidebar container that assembles the profile UI |
| **components/ProfileCard** | View and edit profile name and avatar |
| **components/ContactsList** | Add/remove contacts (`foaf:knows`), with rejection notification display |
| **components/ContactRow** | A single contact with request-access and remove actions |
| **components/RequestsPanel** | Approve or deny incoming access requests from the user's inbox |
| **hooks/useProfile** | Read/write the logged-in user's profile fields |
| **hooks/useContacts** | Manage the `foaf:knows` contact list |
| **hooks/useAccessRequests** | Load, approve, and deny inbox access requests |
