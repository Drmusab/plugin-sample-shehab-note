/**
 * Topbar integration for quick access
 */

import type { Plugin } from "siyuan";
import type { TaskService } from "@/core/TaskService";
import { eventBus } from "@/core/EventBus";
import * as logger from "@/utils/logger";

export class TopbarMenu {
  private plugin: Plugin;
  private taskService: TaskService;
  private topbarElement: HTMLElement | null = null;
  private updateIntervalId: number | null = null;

  constructor(plugin: Plugin, taskService: TaskService) {
    this.plugin = plugin;
    this.taskService = taskService;
  }

  /**
   * Initialize the topbar menu
   */
  init(): void {
    this.createTopbarButton();
    this.startAutoUpdate();
    logger.info("Topbar menu initialized");
  }

  /**
   * Destroy the topbar menu
   */
  destroy(): void {
    if (this.updateIntervalId !== null) {
      clearInterval(this.updateIntervalId);
      this.updateIntervalId = null;
    }

    if (this.topbarElement) {
      this.topbarElement.remove();
      this.topbarElement = null;
    }

    logger.info("Topbar menu destroyed");
  }

  /**
   * Create topbar button
   */
  private createTopbarButton(): void {
    const topbar = this.plugin.addTopBar({
      icon: "iconCalendar",
      title: "Recurring Tasks",
      position: "right",
      callback: () => {
        this.toggleMenu();
      },
    });

    this.topbarElement = topbar;
    this.updateBadge();
  }

  /**
   * Update badge with task count
   */
  private updateBadge(): void {
    if (!this.topbarElement) {
      return;
    }

    const tasks = this.taskService.getTodayAndOverdueTasks();
    const overdueCount = tasks.filter((task) => {
      const dueDate = new Date(task.dueAt);
      const now = new Date();
      return dueDate < now && !this.isToday(dueDate);
    }).length;

    // Update badge
    if (tasks.length > 0) {
      const badge = this.topbarElement.querySelector(".b3-badge") as HTMLElement;
      if (badge) {
        badge.textContent = tasks.length.toString();
        badge.style.display = "block";
        if (overdueCount > 0) {
          badge.style.backgroundColor = "var(--b3-theme-error)";
        } else {
          badge.style.backgroundColor = "var(--b3-theme-primary)";
        }
      } else {
        const newBadge = document.createElement("span");
        newBadge.className = "b3-badge";
        newBadge.textContent = tasks.length.toString();
        newBadge.style.display = "block";
        newBadge.style.backgroundColor = overdueCount > 0
          ? "var(--b3-theme-error)"
          : "var(--b3-theme-primary)";
        this.topbarElement.appendChild(newBadge);
      }
    } else {
      const badge = this.topbarElement.querySelector(".b3-badge");
      if (badge) {
        badge.remove();
      }
    }
  }

  /**
   * Check if date is today
   */
  private isToday(date: Date): boolean {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  }

  /**
   * Toggle dropdown menu
   */
  private toggleMenu(): void {
    // For now, just open the dock
    // In the future, this could show a dropdown menu
    eventBus.emit("recurring-task-settings", { action: "toggle" });
  }

  /**
   * Start auto-update of badge every minute
   */
  private startAutoUpdate(): void {
    this.updateIntervalId = setInterval(() => {
      this.updateBadge();
    }, 60 * 1000) as unknown as number;
  }

  /**
   * Manually trigger badge update
   */
  update(): void {
    this.updateBadge();
  }
}
