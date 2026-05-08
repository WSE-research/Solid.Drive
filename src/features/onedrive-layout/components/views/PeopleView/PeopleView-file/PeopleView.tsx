/**
 * People view for the OneDrive inspired layout.
 *
 * Two-state surface:
 *   - The default list state renders the contacts list flush against
 *     the view background — no card wrapper, no master/detail grid.
 *   - The detail state, entered by clicking a contact, replaces the
 *     view with {@link PersonDetailView}, which mirrors the SharedView
 *     toolbar and reuses {@link SharedFilesTable} scoped to that one
 *     contact.
 *
 * @packageDocumentation
 */

import { useState } from 'react';
import type { FunctionComponent } from 'react';
import { useSolidAuth } from '@ldo/solid-react';
import { OneDrivePeopleList } from './OneDrivePeopleList';
import { PersonDetailView } from './PersonDetailView';

/**
 * Renders the People view shell.
 *
 * @public
 */
export const PeopleView: FunctionComponent = () => {
  const { session } = useSolidAuth();
  const ownerWebId = session.webId ?? '';
  const [selected, setSelected] = useState<string | undefined>(undefined);

  if (selected) {
    return (
      <PersonDetailView
        contactWebId={selected}
        ownerWebId={ownerWebId}
        onBack={() => setSelected(undefined)}
      />
    );
  }

  return (
    <onedrive-view data-view-id="people">
      <OneDrivePeopleList ownerWebId={ownerWebId} onSelect={setSelected} />
    </onedrive-view>
  );
};
