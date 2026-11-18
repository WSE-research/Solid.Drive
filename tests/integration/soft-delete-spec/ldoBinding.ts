/**
 * Stands in for `@ldo/solid-react` in the specification test, so that
 * Solid.Drive's upload and create-folder hooks run against the real LDO
 * library (`@ldo/connected-solid`) and an in-memory Pod, without a browser
 * login. `useLdo` returns what `@ldo/react`'s `createUseLdo` returns for the
 * methods the hooks use: `createData` and `commitData` of one dataset.
 */

import { createSolidLdoDataset } from "@ldo/connected-solid";
import { getDataset } from "@ldo/ldo";
import type { FetchFn } from "@/types/solid";

type SolidLdoDataset = ReturnType<typeof createSolidLdoDataset>;

interface Binding {
  webId: string;
  fetch: FetchFn;
  dataset: SolidLdoDataset;
}

let binding: Binding | null = null;

function current(): Binding {
  if (!binding) throw new Error("No LDO binding: call bindLdo() first");
  return binding;
}

/** Points the stand-in hooks at a Pod and a logged-in WebID, and returns the dataset. */
export function bindLdo(webId: string, fetch: FetchFn): SolidLdoDataset {
  const dataset = createSolidLdoDataset();
  dataset.setContext("solid", { fetch });
  binding = { webId, fetch, dataset };
  return dataset;
}

/** The module that replaces `@ldo/solid-react` through `vi.mock`. */
export const solidReactStub = {
  useSolidAuth: () => ({ session: { webId: current().webId, isLoggedIn: true }, fetch: current().fetch }),
  useLdo: () => {
    const { dataset } = current();
    return {
      dataset,
      getResource: dataset.getResource.bind(dataset),
      createData: dataset.createData.bind(dataset),
      commitData: (input: object) => getDataset(input).commitToRemote(),
    };
  },
};
