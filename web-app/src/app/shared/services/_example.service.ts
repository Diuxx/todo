import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { catchError, map, Observable, throwError } from "rxjs";

// internal.
import { AbstractService } from "./abstract.service";
import { DictionaryElement } from "../../modules/data-management/dictionary/models/dictionary-element.model";
import { displayErrorTranslation } from "@shared/utils/utils";
import { TranslateService } from "@ngx-translate/core";
import { SnackService } from "./snack.service";

@Injectable()
export class DictionaryService extends AbstractService {

  private readonly apiUrl = 'api/replacementDictionary';

  constructor(
    http: HttpClient,
    private translate: TranslateService,
    private snackService: SnackService
  ) {
    super(http);
  }

  /**
   * Get all replacement dictionary elements.
   * @returns A list of @see {DictionaryElement}
   */
  public getAll(): Observable<DictionaryElement[]> {
    return this.http.get(`${this.apiUrl}`).pipe(map((res: Object) => <DictionaryElement[]>res),
      catchError((err) => {
        console.error(err);
        displayErrorTranslation(this.snackService, this.translate, 'toasts.get.error', err)
        return throwError(() => err)
      })
    ) 
  }

  /**
   * Get a dictionary element by it's id.
   * @returns An dictionary element @see {DictionaryElement}. 
   */
  public getOne(id: string): Observable<DictionaryElement> {
    return this.http.get(`${this.apiUrl}/${id}`).pipe(map((res: Object) => <DictionaryElement>res));
  }

  /**
   * Get all existing families from db.
   */
  public getFamilies(): Observable<string[]> {
    return this.http.get(`${this.apiUrl}/families`).pipe(map((res: Object) => <string[]>res));
  }

  /**
   * Create or update given dictionary element.
   * @param element the element to create or update.
   * @see {DictionaryElement}
   */
  public createOrUpdate(element: DictionaryElement) {
    return this.http.put(`${this.apiUrl}`, element).pipe(map((res: Object) => <DictionaryElement>res)
      , catchError((err) => {
        console.error(err);
        var errorMessage = 'toasts.put.error.create';
        if (element.id != null)
          errorMessage = 'toasts.put.error.update';

        displayErrorTranslation(this.snackService, this.translate, errorMessage, err)
        return throwError(() => err)
      })
    );
  }

  /**
   * Delete an dictionary element.
   * @param id the ID of deleted element.
   * @see {DictionaryElement}
   */
  public delete(id: string): Observable<DictionaryElement> {
    return this.http.delete(`${this.apiUrl}/${id}`).pipe(map((res: Object) => <DictionaryElement>res)
      , catchError((err) => {
        console.error(err);
        displayErrorTranslation(this.snackService, this.translate, 'toasts.delete.error', err)
        return throwError(() => err)
      })
    );
  }
}