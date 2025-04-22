export class TaskFilterDto {
    state?: number;
    creatorWallets?: string[];
    assignedAgent?: string;
    topic?: string; //was enum
    offset?: number = 0;
    limit?: number = 10;
}

export interface AgentFilterDto {
    topics?: string[];
    skills?: string[];
    isPaused?: boolean;
    isDeleted?: boolean;
    isAutoAssigned?: boolean;
    offset?: number;
    limit?: number;
}
