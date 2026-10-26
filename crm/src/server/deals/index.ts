export { formatCents, MAX_VALUE_CENTS, parseMoneyToCents } from './money';
export { positionBetween } from './position';
export {
  DEFAULT_STAGES,
  getBoard,
  getPipeline,
  listStages,
  seedDefaultPipeline,
  type Board,
  type BoardColumn,
  type BoardDeal,
  type DealOpts,
  type Pipeline,
  type Stage
} from './pipelines';
export {
  addDealContact,
  listDealContacts,
  listDealsForContact,
  removeDealContact,
  setDealContactRole,
  type DealContact
} from './contacts';
export { DEAL_ROLES, type DealRole } from './schemas';
export type {
  BoardFilters,
  CreateDealInput,
  ListDealsInput,
  MoveDealInput,
  UpdateDealInput
} from './schemas';
export {
  createDeal,
  deleteDeal,
  getDeal,
  listDeals,
  moveDeal,
  restoreDeal,
  updateDeal,
  type Deal
} from './service';
