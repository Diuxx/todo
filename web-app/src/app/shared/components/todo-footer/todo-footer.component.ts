import { Component, Input } from "@angular/core";
import { RouterLink } from "@angular/router";

@Component({
    selector: 'todo-footer',
    templateUrl: './todo-footer.component.html',
    styleUrls: ['./todo-footer.component.scss'],
    imports: [RouterLink]
})
export class TodoFooterComponent {

    @Input() visible: boolean = true;
    

}