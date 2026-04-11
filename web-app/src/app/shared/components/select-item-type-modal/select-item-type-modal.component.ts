import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  selector: 'select-item-type-modal',
  templateUrl: './select-item-type-modal.component.html',
  styleUrls: ['./select-item-type-modal.component.scss'],
  imports: [CommonModule]
})
export class SelectItemTypeModalComponent {

  @Input() visible: boolean = false;
  @Output() selectType = new EventEmitter<'todo' | 'note' | 'citation'>();
  @Output() close = new EventEmitter<void>();

  public selectItemType(type: 'todo' | 'note' | 'citation'): void {
    this.selectType.emit(type);
  }

  public closeModal(): void {
    this.close.emit();
  }
}
