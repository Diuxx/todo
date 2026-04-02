import { CommonModule, TitleCasePipe } from "@angular/common";
import { Component, OnInit } from "@angular/core"
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { HeaderComponent } from "../../../shared/components/header/header.component";
import { ActivatedRoute, Router } from "@angular/router";
import { StorageService } from "../../../shared/services/storage.service";
import { Category } from "../../../shared/models/category.model";
import { Difficulty } from "../../../shared/models/difficulty.model";
import { Frequency } from "../../../shared/models/frequency.model";
import { Quest } from "../../../shared/models/quest.model";
import { NavigationService } from "../../../shared/services/navigation.service";

@Component({
  selector: 'life-quest-create-form',
  templateUrl: './quest-create-form.component.html',
  styleUrls: ['./quest-create-form.component.scss'],
  imports: [TitleCasePipe, CommonModule, ReactiveFormsModule, HeaderComponent]
})
export class QuestCreateFormComponent implements OnInit {

  // -- variables
  public form!: FormGroup;
  public categories: Category[] = [];
  public difficulties: Difficulty[] = [];
  public frequencies: Frequency[] = [];

  private id: string | undefined;
  private questToEdit: Quest | undefined;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly storageService: StorageService,
    private readonly navigationService: NavigationService
  ) { }

  ngOnInit(): void {
    this.getRouteParam();
    this.categories = this.storageService.getCategories();
    this.difficulties = this.storageService.getDifficulties();
    this.frequencies = this.storageService.getFrequencies();

    this.form = new FormGroup({
      id: new FormControl(this.questToEdit?.id ?? ''),
      xp: new FormControl(this.questToEdit?.xp ?? 0, [Validators.min(0)]),
      activated: new FormControl(this.questToEdit?.activated ?? false),
      title: new FormControl(this.questToEdit?.title ?? '', Validators.required),
      category: new FormControl(this.questToEdit?.category ?? '', Validators.required),
      difficulty: new FormControl(this.questToEdit?.difficulty ?? '', Validators.required),
      frequency: new FormControl(this.questToEdit?.frequency ?? '', Validators.required)
    });
  }

  /**
   * Handles the form submission.
   * @returns void
   */
  public onSubmit(): void {
    if (!this.form?.valid)
      return;

    let quest = this.form.value as Quest;
    if (!quest.id || quest.id === '') {
      quest.id = crypto.randomUUID();
      this.storageService.addQuest(quest);
    }
    else {
      this.storageService.updateQuest(quest);
    }

    console.log('Form Submitted!', this.form.value, quest);
    this.router.navigate(['/configuration']);
  }

  /**
   * Navigate back to the dashboard.
   */
  public navigateToDashboard(): void {
    console.log(this.navigationService.getPreviousUrl());
    this.router.navigate([this.navigationService.getPreviousUrl() || '/dashboard']);
  }

  public getId(): string | undefined {
    return this.id;
  }

  private getRouteParam(): void {
    this.id = this.route.snapshot.paramMap.get('id') ?? undefined;
    this.route.paramMap.subscribe(params => { this.id = params.get('id') ?? undefined; });

    this.questToEdit = this.id ? this.storageService.getQuestById(this.id) : undefined;
    console.log('Editing quest with id:', this.id, this.questToEdit);
  }
}