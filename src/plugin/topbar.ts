/**
 * Topbar integration for quick access
 */

import type { Plugin } from "siyuan";
import type { TaskRepositoryProvider } from "@/core/storage/TaskRepository";
import { pluginEventBus } from "@/core/events/PluginEventBus";
import { TOPBAR_ICON_ID } from "@/utils/constants";
import { isToday } from "@/utils/date";
import * as logger from "@/utils/logger";

export class TopbarMenu {
  private plugin: Plugin;
  private repository: TaskRepositoryProvider;
  private topbarElement: HTMLElement | null = null;
  private updateIntervalId: number | null = null;

  constructor(plugin: Plugin, repository: TaskRepositoryProvider) {
    this.plugin = plugin;
    this.repository = repository;
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
      globalThis.clearInterval(this.updateIntervalId);
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

    const tasks = this.repository.getTodayAndOverdueTasks();
    const overdueCount = tasks.filter((task) => {
      const dueDate = new Date(task.dueAt);
      const now = new Date();
      return dueDate < now && !isToday(dueDate);
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
   * Toggle dropdown menu
   */
  private toggleMenu(): void {
    // For now, just open the dock
    // In the future, this could show a dropdown menu
    
    // Use pluginEventBus for internal communication
    pluginEventBus.emit('task:settings', { action: 'toggle' });
    
    // Also dispatch window event for backward compatibility
    const event = new CustomEvent("recurring-task-settings", {
      detail: { action: "toggle" },
    });
    window.dispatchEvent(event);
  }

  /**
   * Start auto-update of badge every minute
   */
  private startAutoUpdate(): void {
    this.updateIntervalId = globalThis.setInterval(() => {
      this.updateBadge();
    }, 60 * 1000);
  }

  /**
   * Manually trigger badge update
   */
  update(): void {
    this.updateBadge();
  }
}
