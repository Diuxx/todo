import { Component, Input } from "@angular/core";

@Component({
    selector: 'todo-footer',
    templateUrl: './todo-footer.component.html',
    styleUrls: ['./todo-footer.component.scss'],
    imports: []
})
export class TodoFooterComponent {

    @Input() visible: boolean = true;
    

}