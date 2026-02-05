/**
 * TeamService - Family/Team task sharing
 *
 * Features:
 * - Create teams (family, work, study groups)
 * - Share tasks with team members
 * - Assign tasks to members
 * - View team progress
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Team,
  TeamMember,
  SharedTask,
  Task,
  EnergyLevel,
} from '../types';

const STORAGE_KEYS = {
  TEAMS: 'nero_teams',
  SHARED_TASKS: 'nero_shared_tasks',
};

export class TeamService {
  private teams: Team[] = [];
  private sharedTasks: SharedTask[] = [];

  async initialize(): Promise<void> {
    try {
      const [teamsJson, tasksJson] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.TEAMS),
        AsyncStorage.getItem(STORAGE_KEYS.SHARED_TASKS),
      ]);

      if (teamsJson) {
        this.teams = JSON.parse(teamsJson);
      }
      if (tasksJson) {
        this.sharedTasks = JSON.parse(tasksJson);
      }
    } catch (error) {
      console.error('Failed to initialize TeamService:', error);
    }
  }

  // ============ TEAM MANAGEMENT ============

  getTeams(): Team[] {
    return [...this.teams];
  }

  getTeam(teamId: string): Team | null {
    return this.teams.find(t => t.id === teamId) || null;
  }

  async createTeam(
    name: string,
    type: Team['type'],
    creatorName: string
  ): Promise<Team> {
    const team: Team = {
      id: `team_${Date.now()}`,
      name,
      type,
      createdBy: 'me', // Would be actual user ID
      members: [
        {
          userId: 'me',
          displayName: creatorName,
          role: 'owner',
          joinedAt: new Date().toISOString(),
          canAssignTasks: true,
          canViewAllTasks: true,
        },
      ],
      sharedTasks: [],
      createdAt: new Date().toISOString(),
    };

    this.teams.push(team);
    await this.saveTeams();
    return team;
  }

  async updateTeam(teamId: string, updates: Partial<Team>): Promise<Team | null> {
    const team = this.teams.find(t => t.id === teamId);
    if (!team) return null;

    Object.assign(team, updates);
    await this.saveTeams();
    return team;
  }

  async deleteTeam(teamId: string): Promise<boolean> {
    const team = this.teams.find(t => t.id === teamId);
    if (!team) return false;

    // Only owner can delete
    const myMembership = team.members.find(m => m.userId === 'me');
    if (myMembership?.role !== 'owner') return false;

    this.teams = this.teams.filter(t => t.id !== teamId);
    this.sharedTasks = this.sharedTasks.filter(t => t.teamId !== teamId);

    await this.saveTeams();
    await this.saveTasks();
    return true;
  }

  // ============ MEMBER MANAGEMENT ============

  async addMember(
    teamId: string,
    displayName: string,
    options?: {
      role?: TeamMember['role'];
      canAssignTasks?: boolean;
      canViewAllTasks?: boolean;
    }
  ): Promise<TeamMember | null> {
    const team = this.teams.find(t => t.id === teamId);
    if (!team) return null;

    const member: TeamMember = {
      userId: `pending_${Date.now()}`, // Would be set when user accepts
      displayName,
      role: options?.role || 'member',
      joinedAt: new Date().toISOString(),
      canAssignTasks: options?.canAssignTasks ?? false,
      canViewAllTasks: options?.canViewAllTasks ?? true,
    };

    team.members.push(member);
    await this.saveTeams();
    return member;
  }

  async updateMember(
    teamId: string,
    userId: string,
    updates: Partial<TeamMember>
  ): Promise<TeamMember | null> {
    const team = this.teams.find(t => t.id === teamId);
    if (!team) return null;

    const member = team.members.find(m => m.userId === userId);
    if (!member) return null;

    Object.assign(member, updates);
    await this.saveTeams();
    return member;
  }

  async removeMember(teamId: string, userId: string): Promise<boolean> {
    const team = this.teams.find(t => t.id === teamId);
    if (!team) return false;

    // Can't remove owner
    const member = team.members.find(m => m.userId === userId);
    if (member?.role === 'owner') return false;

    team.members = team.members.filter(m => m.userId !== userId);
    await this.saveTeams();
    return true;
  }

  getTeamMembers(teamId: string): TeamMember[] {
    const team = this.teams.find(t => t.id === teamId);
    return team ? [...team.members] : [];
  }

  // ============ SHARED TASKS ============

  async shareTask(
    teamId: string,
    title: string,
    energy: EnergyLevel,
    options?: {
      assignedTo?: string[];
      visibility?: SharedTask['visibility'];
      dueDate?: string;
    }
  ): Promise<SharedTask | null> {
    const team = this.teams.find(t => t.id === teamId);
    if (!team) return null;

    const task: SharedTask = {
      id: `shared_${Date.now()}`,
      title,
      energy,
      completed: false,
      isMicroStep: false,
      createdAt: new Date().toISOString(),
      teamId,
      assignedTo: options?.assignedTo,
      visibility: options?.visibility || 'team',
      dueDate: options?.dueDate,
    };

    this.sharedTasks.push(task);
    team.sharedTasks.push(task.id);

    await this.saveTasks();
    await this.saveTeams();
    return task;
  }

  async shareExistingTask(
    task: Task,
    teamId: string,
    assignedTo?: string[]
  ): Promise<SharedTask | null> {
    const team = this.teams.find(t => t.id === teamId);
    if (!team) return null;

    const sharedTask: SharedTask = {
      ...task,
      teamId,
      assignedTo,
      visibility: 'team',
    };

    this.sharedTasks.push(sharedTask);
    team.sharedTasks.push(sharedTask.id);

    await this.saveTasks();
    await this.saveTeams();
    return sharedTask;
  }

  getSharedTasks(teamId: string): SharedTask[] {
    return this.sharedTasks.filter(t => t.teamId === teamId);
  }

  getMyAssignedTasks(): SharedTask[] {
    return this.sharedTasks.filter(t =>
      t.assignedTo?.includes('me') && !t.completed
    );
  }

  async assignTask(taskId: string, userIds: string[]): Promise<SharedTask | null> {
    const task = this.sharedTasks.find(t => t.id === taskId);
    if (!task) return null;

    task.assignedTo = userIds;
    await this.saveTasks();
    return task;
  }

  async completeSharedTask(taskId: string): Promise<SharedTask | null> {
    const task = this.sharedTasks.find(t => t.id === taskId);
    if (!task) return null;

    task.completed = true;
    task.completedAt = new Date().toISOString();
    await this.saveTasks();
    return task;
  }

  async deleteSharedTask(taskId: string): Promise<boolean> {
    const task = this.sharedTasks.find(t => t.id === taskId);
    if (!task) return false;

    // Remove from team
    const team = this.teams.find(t => t.id === task.teamId);
    if (team) {
      team.sharedTasks = team.sharedTasks.filter(id => id !== taskId);
      await this.saveTeams();
    }

    this.sharedTasks = this.sharedTasks.filter(t => t.id !== taskId);
    await this.saveTasks();
    return true;
  }

  // ============ TEAM STATISTICS ============

  getTeamStats(teamId: string): {
    totalTasks: number;
    completedTasks: number;
    memberContributions: Array<{
      userId: string;
      displayName: string;
      tasksCompleted: number;
    }>;
    completionRate: number;
  } {
    const team = this.teams.find(t => t.id === teamId);
    if (!team) {
      return {
        totalTasks: 0,
        completedTasks: 0,
        memberContributions: [],
        completionRate: 0,
      };
    }

    const tasks = this.sharedTasks.filter(t => t.teamId === teamId);
    const completed = tasks.filter(t => t.completed);

    // Calculate member contributions (simplified - in real app would track who completed)
    const contributions = team.members.map(member => ({
      userId: member.userId,
      displayName: member.displayName,
      tasksCompleted: Math.floor(Math.random() * completed.length), // Placeholder
    }));

    return {
      totalTasks: tasks.length,
      completedTasks: completed.length,
      memberContributions: contributions,
      completionRate: tasks.length > 0
        ? Math.round((completed.length / tasks.length) * 100)
        : 0,
    };
  }

  // ============ TEAM PRESETS ============

  getTeamPresets(): Array<{
    type: Team['type'];
    name: string;
    description: string;
    emoji: string;
    suggestedTasks: string[];
  }> {
    return [
      {
        type: 'family',
        name: 'Family',
        description: 'Share household tasks with family members',
        emoji: '👨‍👩‍👧‍👦',
        suggestedTasks: [
          'Take out trash',
          'Do dishes',
          'Laundry',
          'Vacuum living room',
          'Grocery shopping',
        ],
      },
      {
        type: 'work',
        name: 'Work Team',
        description: 'Collaborate on work projects',
        emoji: '💼',
        suggestedTasks: [
          'Weekly report',
          'Team meeting prep',
          'Review documents',
          'Send updates',
          'Plan sprint',
        ],
      },
      {
        type: 'study_group',
        name: 'Study Group',
        description: 'Study together with classmates',
        emoji: '📚',
        suggestedTasks: [
          'Read chapter',
          'Review notes',
          'Practice problems',
          'Group study session',
          'Quiz prep',
        ],
      },
      {
        type: 'custom',
        name: 'Custom',
        description: 'Create your own team type',
        emoji: '✨',
        suggestedTasks: [],
      },
    ];
  }

  // ============ STORAGE ============

  private async saveTeams(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.TEAMS, JSON.stringify(this.teams));
    } catch (error) {
      console.error('Failed to save teams:', error);
    }
  }

  private async saveTasks(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SHARED_TASKS, JSON.stringify(this.sharedTasks));
    } catch (error) {
      console.error('Failed to save shared tasks:', error);
    }
  }
}

// Singleton instance
let serviceInstance: TeamService | null = null;

export function getTeamService(): TeamService {
  if (!serviceInstance) {
    serviceInstance = new TeamService();
  }
  return serviceInstance;
}

export async function initializeTeamService(): Promise<TeamService> {
  const service = getTeamService();
  await service.initialize();
  return service;
}
