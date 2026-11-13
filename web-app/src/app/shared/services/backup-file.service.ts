import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { environment } from '../../../env/env';
import { AppData } from '../models/app-data.model';

@Injectable({ providedIn: 'root' })
export class BackupFileService {
  public async download(payload: AppData): Promise<void> {
    const json = JSON.stringify(payload, null, 2);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `todo-backup-${timestamp}.json`;

    if (Capacitor.isNativePlatform()) {
      await this.downloadOnDevice(fileName, json);
      return;
    }

    this.downloadInBrowser(fileName, json);
  }

  private downloadInBrowser(fileName: string, json: string): void {
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');

    try {
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
    } finally {
      link.remove();
      URL.revokeObjectURL(downloadUrl);
    }
  }

  private async downloadOnDevice(fileName: string, json: string): Promise<void> {
    const permissions = await Filesystem.checkPermissions();

    if (permissions.publicStorage !== 'granted') {
      const requested = await Filesystem.requestPermissions();
      if (requested.publicStorage !== 'granted') {
        throw new Error('Storage permission denied');
      }
    }

    const result = await Filesystem.writeFile({
      path: fileName,
      data: json,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      recursive: true,
    });

    await Share.share({
      title: `todo-v${environment.appVersion}-backup`,
      text: `Fichier exporte: ${fileName}`,
      url: result.uri,
      dialogTitle: 'Enregistrer ou partager la sauvegarde',
    });
  }
}
