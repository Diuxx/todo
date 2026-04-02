import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TodoHeaderComponent } from './shared/components/header/todo-header.component';
import { TodoFooterComponent } from './shared/components/todo-footer/todo-footer.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TodoHeaderComponent, TodoFooterComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {

  // variables
  title = 'to-do';

  ngOnInit(): void {
    console.log('init application.');
  }
}