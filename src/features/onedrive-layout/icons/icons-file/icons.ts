/**
 * Semantic re-exports of Fluent UI icons for the OneDrive-inspired layout.
 * This is the only file allowed to import from `@fluentui/react-icons` directly;
 * all other modules must import from here.
 *
 * @packageDocumentation
 */

// Keep this list lean. Add a single line here when a new icon is needed;
// the ESLint rule restricts @fluentui/react-icons imports to this file.

export {
  HomeRegular         as HomeIcon,
  FolderRegular       as MyFilesIcon,
  PeopleRegular       as SharedIcon,
  MailInboxRegular    as RequestsIcon,
  PersonRegular       as PeopleIcon,
  ChevronDownRegular  as ChevronDownIcon,
  ChevronUpRegular    as ChevronUpIcon,
  ChevronLeftRegular  as ChevronLeftIcon,
  AddRegular          as PlusIcon,
  SettingsRegular     as GearIcon,
  SearchRegular       as SearchIcon,
  CheckmarkRegular    as CheckmarkIcon,
  ArrowSortDownLinesRegular as SortIcon,
  InfoRegular         as InfoIcon,
  DismissRegular      as CloseIcon,
  ShareRegular            as ShareIcon,
  LinkRegular             as LinkIcon,
  DeleteRegular           as DeleteIcon,
  OpenRegular             as OpenIcon,
  ArrowDownloadRegular    as DownloadIcon,
  FolderArrowRightRegular as MoveToIcon,
  RenameRegular           as RenameIcon,
  KeyRegular              as RequestAccessIcon,
  MoreHorizontalRegular   as MoreHorizontalIcon,
  PanelRightContractRegular as DetailsPanelIcon,
  PanelRightExpandRegular   as DetailsPanelIconActive,
  PanelLeftContractRegular  as NavRailCollapseIcon,
  PanelLeftExpandRegular    as NavRailExpandIcon,
  AlertRegular              as BellIcon,
  DesktopArrowDownRegular   as InstallIcon,
} from '@fluentui/react-icons';

export {
  HomeFilled       as HomeIconActive,
  FolderFilled     as MyFilesIconActive,
  PeopleFilled     as SharedIconActive,
  MailInboxFilled  as RequestsIconActive,
  PersonFilled     as PeopleIconActive,
  AlertFilled      as BellIconActive,
} from '@fluentui/react-icons';
