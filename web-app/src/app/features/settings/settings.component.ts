import { Component } from "@angular/core";
import { FormBuilder, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { NgClass } from "@angular/common";

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
  imports: [ReactiveFormsModule, NgClass],
})
export class SettingsComponent implements OnInit {

  
  public ngOnInit(): void {
  
  }
  

  /**
   * TODO: Implement settings form and logic to load/save settings data
   */
  private getSettingsData(): void {

  }

}