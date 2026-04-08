import { Injectable } from "@angular/core";
import { db } from "../../db.config";
import { generateUUID } from "../utils";
import { appDataExample } from "../models/mock-data";
import { PasswordService } from "./password.service";

@Injectable({
    providedIn: 'root'
})
export class DatabaseService {
    private readonly SETTINGS_ID = 'app-settings';
    private readonly passwordService = new PasswordService();

    /**
     * Initialize the database and create default settings if not exist.
     */
    public async init(): Promise<void> {
        await db.open();

        const hasSettings = await db.settings.get(this.SETTINGS_ID);
        if (!hasSettings) {
            await this.createDefaultSettings();
            await this.seedDefaultData();

            console.info('Database initialized with default settings and data.');
            window.location.reload(); // reload to ensure all components get the initial settings loaded properly.
            return;
        }

        if (!hasSettings.passwordHash) {
            await db.settings.put({
                ...hasSettings,
                passwordHash: this.passwordService.defaultPasswordHash,
            });
        }
    }

    /**
     * Seed the database with default data for development or first-time users.
     */
    private async createDefaultSettings(): Promise<void> {
        await db.settings.add({
            id: this.SETTINGS_ID,
            theme: 'system',
            language: 'fr',
            dailyAffirmationEnabled: false,
            showArchivedItems: false,
            passwordHash: this.passwordService.defaultPasswordHash,
            userName: 'Nouvel Utilisateur',
            userId: generateUUID()
        });
    }

    /**
     * Seed the database with default data for development or first-time users.
     */
    private async seedDefaultData(): Promise<void> {
        // Add default items, etc. here if needed.
        await db.items.bulkAdd([...appDataExample.items]);
        await db.todoHistory.bulkAdd([...appDataExample.todoHistory]);
        await db.citationsMeta.bulkAdd([...appDataExample.citationsMeta]);
        await db.imagesMeta.bulkAdd([...appDataExample.imagesMeta]);
    }

    /**
     * Clears all user content while preserving application settings.
     */
    public async clearUserContent(): Promise<void> {
        await db.transaction('rw', [db.items, db.todoHistory, db.citationsMeta, db.imagesMeta], async () => {
            await db.items.clear();
            await db.todoHistory.clear();
            await db.citationsMeta.clear();
            await db.imagesMeta.clear();
        });
    }
}