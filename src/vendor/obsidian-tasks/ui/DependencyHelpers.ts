import type { Task } from '../types/Task';
import { GlobalFilter } from '../types/Stubs';

const MAX_SEARCH_RESULTS = 20;

/**
 * Return the text to use for searching and displaying tasks, for the dependency fields.
 *
 * The global filter is removed, but sub-tags of the global filter are
 * not removed.
 * @param task
 */
export function descriptionAdjustedForDependencySearch(task: Task) {
    return GlobalFilter.getInstance().removeAsWordFrom(task.description);
}

function simpleSearch(query: string, text: string): number {
    if (!query) return 0;
    const lowerQuery = query.toLowerCase();
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes(lowerQuery)) {
        // Score based on position - earlier matches score higher
        const index = lowerText.indexOf(lowerQuery);
        return -index / 100; // Negative scores, closer to 0 is better
    }
    return -1000; // Very poor match
}

function searchDescriptionWithoutTags(query: string, allTasks: Task[]): Task[] {
    if (query === '') {
        return allTasks;
    }

    const minimumScoreCutoff = -4.0;

    const matches = allTasks
        .map((task) => {
            const text = descriptionAdjustedForDependencySearch(task);
            const score = simpleSearch(query, text);
            
            if (score > minimumScoreCutoff) {
                return { task, score };
            }
            return null;
        })
        .filter(Boolean) as Array<{ task: Task; score: number }>;

    // All scores are negative. Closer to zero is better.
    const sortedMatches = matches.sort((a, b) => b.score - a.score);

    return sortedMatches.map((item) => item.task);
}

export function searchForCandidateTasksForDependency(
    search: string,
    allTasks: Task[],
    task?: Task,
    blockedBy?: Task[],
    blocking?: Task[],
) {
    let results = searchDescriptionWithoutTags(search, allTasks);

    results = results.filter((item) => {
        // Do not show any tasks that look like templates:
        if (item.description.includes('<%') && item.description.includes('%>')) {
            return false;
        }

        // remove itself from results
        const sameTask = item.description === task?.description && item.id === task?.id;
        if (sameTask) {
            return false;
        }

        //remove tasks this task already has a relationship with from results
        if (blockedBy?.includes(item) || blocking?.includes(item)) {
            return false;
        }

        return true;
    });

    // if a task is provided, show close Relations higher
    if (task) {
        // search results favour tasks from the same file as this task
        results.sort((a, b) => {
            const aInSamePath = a.path === task.path;
            const bInSamePath = b.path === task.path;

            if (aInSamePath && bInSamePath) {
                // Can't sort by line number without it, so just return equal
                return 0;
            } else if (aInSamePath) {
                return -1;
            } else if (bInSamePath) {
                return 1;
            } else {
                return 0;
            }
        });
    }

    return results.slice(0, MAX_SEARCH_RESULTS);
}
