import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

@Component({
  standalone: true,
  selector: 'item-admin-modal',
  templateUrl: './item-admin-modal.component.html',
  styleUrls: ['./item-admin-modal.component.scss'],
  imports: [ReactiveFormsModule],
})
export class ItemAdminModalComponent {
  @Input() visible: boolean = false;
  @Input() itemForm?: FormGroup;
  @Input() itemType?: string;

  @Output() close = new EventEmitter<void>();

  public closeModal(): void {
    this.close.emit();
  }
}
