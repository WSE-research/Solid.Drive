/**
 * Inline drop-zone banner rendered between the search box and the file
 * listing while the user is dragging files over the explorer panel.
 *
 * @packageDocumentation
 */

import type { FunctionComponent } from "react";
import { useTranslation } from "react-i18next";

interface DropZoneProps {
  visible: boolean;
  destinationLabel: string;
}

/**
 * Renders the drop-zone banner. The component owns no state; the parent
 * decides when `visible` is true and which destination label to show.
 *
 * @public
 */
export const DropZone: FunctionComponent<DropZoneProps> = ({ visible, destinationLabel }) => {
  const [translate] = useTranslation();
  if (!visible) return null;
  const bannerText = translate("fileExplorer.dropZoneLabel", { destination: destinationLabel });
  return (
    <drop-zone className="drop-zone--active">
      <drop-zone-icon>⤓</drop-zone-icon>
      <drop-zone-label>{bannerText}</drop-zone-label>
    </drop-zone>
  );
};
