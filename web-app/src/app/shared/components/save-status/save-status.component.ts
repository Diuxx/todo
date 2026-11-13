import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormSaveState } from '../../services/save-action.service';

@Component({
  standalone: true,
  selector: 'app-save-status',
  templateUrl: './save-status.component.html',
  styleUrls: ['./save-status.component.scss'],
})
export class SaveStatusComponent {
  @Input() state: FormSaveState = 'pristine';
  @Input() errorMessage: string | null = null;
  @Output() retry = new EventEmitter<void>();
}
