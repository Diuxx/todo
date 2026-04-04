import { NgClass } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RecurrenceType } from "../../../shared/models/base-entity.model";
import { TodoInformation } from "../../../shared/models/app-item.model";

@Component({
  standalone: true,
  selector: 'todo-edit-modal',
  templateUrl: './todo-edit-modal.component.html',
  styleUrls: ['./todo-edit-modal.component.scss'],
  imports: [FormsModule, NgClass]
})
export class TodoEditModalComponent {

  @Input() visible: boolean = false;
  @Input() subItem?: TodoInformation;

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<void>();

  public readonly recurrenceOptions: RecurrenceType[] = ['none', 'daily', 'weekly', 'monthly'/*, 'custom'*/];

  public selectRecurrence(type: RecurrenceType): void {
    const config = this.getOrCreateConfig();
    config.recurrenceType = type;
  }

  public toggleAlert(): void {
    const config = this.getOrCreateConfig();
    config.alertEnabled = !config.alertEnabled;

    if (!config.alertEnabled) {
      config.alertAt = undefined;
    }
  }

  public updateAlertAt(value: string): void {
    const config = this.getOrCreateConfig();
    config.alertAt = value;
  }

  public closeModal(): void {
    this.close.emit();
  }

  public saveModal(): void {
    this.save.emit();
  }

  private getOrCreateConfig() {
    if (!this.subItem) {
      throw new Error('Todo sub item is required');
    }

    if (!this.subItem.config) {
      this.subItem.config = {
        status: 'pending',
        recurrenceType: 'none',
        alertEnabled: false,
      };
    }

    return this.subItem.config;
  }
}
