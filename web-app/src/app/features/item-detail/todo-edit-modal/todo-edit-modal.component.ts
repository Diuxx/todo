import { NgClass } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormGroup, ReactiveFormsModule } from "@angular/forms";
import { RecurrenceType } from "../../../shared/models/base-entity.model";

@Component({
  standalone: true,
  selector: 'todo-edit-modal',
  templateUrl: './todo-edit-modal.component.html',
  styleUrls: ['./todo-edit-modal.component.scss'],
  imports: [ReactiveFormsModule, NgClass]
})
export class TodoEditModalComponent {

  @Input() visible: boolean = false;
  @Input() subItemForm?: FormGroup;

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<void>();

  public readonly recurrenceOptions: RecurrenceType[] = ['none', 'daily', 'weekly', 'monthly'/*, 'custom'*/];

  public selectRecurrence(type: RecurrenceType): void {
    this.subItemForm?.get('recurrenceType')?.setValue(type);
    this.subItemForm?.markAllAsDirty();
  }

  public toggleAlert(): void {
    this.subItemForm?.markAllAsDirty();
    const alertEnabledControl = this.subItemForm?.get('alertEnabled');
    if (!alertEnabledControl) {
      return;
    }

    const nextValue = !alertEnabledControl.value;
    alertEnabledControl.setValue(nextValue);

    if (!nextValue) {
      this.subItemForm?.get('alertAt')?.setValue('');
    }
  }

  public closeModal(): void {
    this.close.emit();
  }

  public saveModal(): void {
    this.save.emit();
  }
}
