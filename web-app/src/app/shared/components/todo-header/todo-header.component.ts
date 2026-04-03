import { Component, Input } from "@angular/core";

@Component({
  standalone: true,
  selector: 'todo-header',
  templateUrl: './todo-header.component.html',
  styleUrls: ['./todo-header.component.scss'],
  imports: []
})
export class TodoHeaderComponent {

  @Input() rightContent: boolean = true;
  @Input() leftContent: boolean = true;
  @Input() visible: boolean = true;

  constructor() { /* */ }
}