/**
 * Semantic re-exports of Fluent UI icons for the OneDrive-inspired layout.
 * This is the only file in the codebase allowed to import from
 * `@fluentui/react-icons` directly — all other modules must import from here.
 *
 * @packageDocumentation
 */

// NOTE: keep this list lean. When a new icon is needed, add a single line
// here rather than scattering @fluentui/react-icons imports across the app
// — the ESLint rule restricts that import to this file.

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
  ArrowDownloadRegular    as DownloadIcon,
  FolderArrowRightRegular as MoveToIcon,
  RenameRegular           as RenameIcon,
  KeyRegular              as RequestAccessIcon,
  MoreHorizontalRegular   as MoreHorizontalIcon,
  PanelRightContractRegular as DetailsPanelIcon,
  PanelRightExpandRegular   as DetailsPanelIconActive,
} from '@fluentui/react-icons';

export {
  HomeFilled       as HomeIconActive,
  FolderFilled     as MyFilesIconActive,
  PeopleFilled     as SharedIconActive,
  MailInboxFilled  as RequestsIconActive,
  PersonFilled     as PeopleIconActive,
} from '@fluentui/react-icons';
