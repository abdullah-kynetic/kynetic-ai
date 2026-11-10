import { DEFAULT_STAGES } from '../deals/pipelines';
import {
  INDUSTRY_TEMPLATES,
  type IndustryTemplateKey,
  type TemplateStage
} from './industry-templates';

export type PlannedStage = {
  id: string;
  name: string;
  probability: number;
  isWon: boolean;
  isLost: boolean;
};

export type StagePlan =
  | { status: 'not-defined' }
  | { status: 'unchanged' }
  | { status: 'customized' }
  | { status: 'rename'; updates: { id: string; name: string; probability: number }[] };

export function defaultStageSpecs(): TemplateStage[] {
  return DEFAULT_STAGES.map(([name, probability, isWon, isLost]) => ({
    name,
    probability,
    isWon,
    isLost
  }));
}

function sameNames(current: readonly PlannedStage[], spec: readonly TemplateStage[]): boolean {
  return (
    current.length === spec.length &&
    current.every((stage, index) => stage.name === spec[index].name)
  );
}

function sameFlags(current: readonly PlannedStage[], spec: readonly TemplateStage[]): boolean {
  return (
    current.length === spec.length &&
    current.every(
      (stage, index) => stage.isWon === spec[index].isWon && stage.isLost === spec[index].isLost
    )
  );
}

/**
 * Rename only when the pipeline is still the F-17 default, in order, with the same won/lost flags.
 * A pipeline that was already edited is left alone. A second apply is unchanged.
 */
export function planStageApply(
  current: readonly PlannedStage[],
  templateStages: readonly TemplateStage[] | undefined
): StagePlan {
  if (!templateStages?.length) return { status: 'not-defined' };
  if (sameNames(current, templateStages)) return { status: 'unchanged' };
  if (sameNames(current, defaultStageSpecs()) && sameFlags(current, templateStages)) {
    const updates = current.flatMap((stage, index) => {
      const next = templateStages[index]!;
      if (stage.name === next.name && stage.probability === next.probability) return [];
      return [{ id: stage.id, name: next.name, probability: next.probability }];
    });
    return updates.length ? { status: 'rename', updates } : { status: 'unchanged' };
  }
  return { status: 'customized' };
}

/** An empty service list means the template does not set services. It does not clear a custom list. */
export function planServicesApply(
  current: readonly string[],
  templateServices: readonly string[]
): 'not-defined' | 'unchanged' | 'replace' {
  if (templateServices.length === 0) return 'not-defined';
  if (
    current.length === templateServices.length &&
    current.every((service, index) => service === templateServices[index])
  )
    return 'unchanged';
  return 'replace';
}

export function industryDefinesStages(key: IndustryTemplateKey): boolean {
  return Boolean(INDUSTRY_TEMPLATES[key].stages?.length);
}
