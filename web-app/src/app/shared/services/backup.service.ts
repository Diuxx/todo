import { Injectable } from "@angular/core";


@Injectable({ providedIn: 'root' })
export class BackupService {

    // au premier lancement on fait une authentification anonyme auprès de supabase.
    // const { data, error } = await supabase.auth.signInAnonymously()


    /**
     * 
     */
    public async backupData(data: any): Promise<void> {
        return;
    }

    /**
     * 
     */
    public async restoreData(): Promise<any> {
        return null;
    }

}