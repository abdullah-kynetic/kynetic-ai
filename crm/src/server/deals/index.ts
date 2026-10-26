export { getDealDetail, type DealDetail, type DealPerson } from './detail';
export { centsToInput, parseDealForm, type DealFormInput, type ParsedDealForm } from './form';
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
  createStage,
  deleteStage,
  listStagesWithCounts,
  MAX_STAGES,
  reorderStages,
  updateStage,
  type StageRow
} from './stages';
export { getBoardView, type BoardView } from './board';
export { dealsScope, stageScope } from './scope';
export { DEAL_ROLES } from './schemas';
export type {
  BoardFilters,
  CreateDealInput,
  CreateStageInput,
  DeleteStageInput,
  ListDealsInput,
  MoveDealInput,
  ReorderStagesInput,
  UpdateDealInput,
  UpdateStageInput
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
