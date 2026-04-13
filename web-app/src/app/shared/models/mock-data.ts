import { AppData } from './app-data.model';

const now = new Date();

const todayDoneAt = new Date(now);
todayDoneAt.setHours(9, 30, 0, 0);

const yesterdayDoneAt = new Date(now);
yesterdayDoneAt.setDate(yesterdayDoneAt.getDate() - 1);
yesterdayDoneAt.setHours(8, 45, 0, 0);

const weekStart = new Date(now);
const dayOfWeek = weekStart.getDay(); // 0 = Sunday, 1 = Monday
const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
weekStart.setDate(weekStart.getDate() - daysSinceMonday);
weekStart.setHours(0, 0, 0, 0);

const thisWeekDoneAt = new Date(weekStart);
thisWeekDoneAt.setDate(thisWeekDoneAt.getDate() + 2);
thisWeekDoneAt.setHours(10, 15, 0, 0);

const lastWeekDoneAt = new Date(weekStart);
lastWeekDoneAt.setDate(lastWeekDoneAt.getDate() - 2);
lastWeekDoneAt.setHours(10, 15, 0, 0);

const monthStart = new Date(now);
monthStart.setDate(1);
monthStart.setHours(0, 0, 0, 0);

const thisMonthDoneAt = new Date(monthStart);
thisMonthDoneAt.setDate(thisMonthDoneAt.getDate() + 3);
thisMonthDoneAt.setHours(7, 50, 0, 0);

const lastMonthDoneAt = new Date(monthStart);
lastMonthDoneAt.setDate(0); // last day of previous month
lastMonthDoneAt.setHours(7, 50, 0, 0);

const twoDaysAgoDoneAt = new Date(now);
twoDaysAgoDoneAt.setDate(twoDaysAgoDoneAt.getDate() - 2);
twoDaysAgoDoneAt.setHours(7, 5, 0, 0);

const threeDaysAgoDoneAt = new Date(now);
threeDaysAgoDoneAt.setDate(threeDaysAgoDoneAt.getDate() - 3);
threeDaysAgoDoneAt.setHours(7, 12, 0, 0);

function atDaysAgo(daysAgo: number, hour: number, minute: number): Date {
  const date = new Date(now);
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function atWeeksAgo(weeksAgo: number, daysAfterMonday: number, hour: number, minute: number): Date {
  const date = new Date(weekStart);
  date.setDate(date.getDate() - weeksAgo * 7 + daysAfterMonday);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function atMonthsAgo(monthsAgo: number, dayOfMonth: number, hour: number, minute: number): Date {
  const date = new Date(monthStart);
  date.setMonth(date.getMonth() - monthsAgo);
  date.setDate(dayOfMonth);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function createHistoryEntry(id: string, todoItemId: string, completedAt: Date) {
  return {
    id,
    todoItemId,
    status: 'done' as const,
    completedAt: completedAt.toISOString(),
    createdAt: completedAt.toISOString(),
    updatedAt: completedAt.toISOString(),
  };
}

export const appDataExample: AppData = {
  id: 'example_data_1',
  items: [
    {
      id: 'item_note_1',
      type: 'note',
      title: 'Mes idées du matin',
      content:
        "Créer une app qui regroupe notes, motivation et discipline. Et un autre texte beaucoup trop long pour etre affiché dans la case. je crois qu'il en faut beaucoup plus pour que ça passe... ah et pas de petits points à la fin ",
      color: 'blue',
      visibility: 'private',
      isArchived: false,
      isFavorite: true,
      isLocked: false,
      isAffirmation: false,
      tags: ['vision', 'projet'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'item_note_2',
      type: 'note',
      title: "Idées pour l'app",
      content:
        "- Ajouter un mode focus (timer Pomodoro)\n- Intégrer des statistiques de complétion\n- Notifications intelligentes selon l'heure de réveil\n- Widget Android pour cocher les tâches du matin\n- Mode collaboratif pour partager des routines",
      color: 'yellow',
      visibility: 'private',
      isArchived: false,
      isFavorite: false,
      isLocked: false,
      isAffirmation: false,
      tags: ['projet', 'dev', 'idées'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'item_note_3',
      type: 'note',
      title: "Objectifs du mois d'avril",
      content:
        "1. Finir le MVP de l'app avant le 30\n2. Lire 2 livres complets\n3. Courir 3 fois par semaine minimum\n4. Réduire le temps d'écran à moins de 2h/jour\n5. Méditer chaque matin sans exception",
      color: 'purple',
      visibility: 'private',
      isArchived: false,
      isFavorite: true,
      isLocked: false,
      isAffirmation: false,
      tags: ['objectifs', 'mensuel', 'discipline'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'item_todo_1',
      type: 'todo',
      title: 'Lire 30 minutes',
      todoContent: [
        {
          id: 'item_todo_1_sub_1',
          title: 'Choisir un livre ete un texte beaucoup trop long pour etre affiché dans la case.',
          config: {
            criticality: 'm',
            status: 'pending',
            recurrenceType: 'daily',
            recurrenceRule: 'daily',
            alertEnabled: true,
            alertAt: '08:00',
            nextDueAt: new Date().toISOString(),
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'item_todo_1_sub_2',
          title: 'Lire au moins 30 minutes',
          config: {
            criticality: 'h',
            status: 'done',
            recurrenceType: 'weekly',
            alertEnabled: false,
            lastCompletedAt: new Date().toISOString(),
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'item_todo_1_sub_3',
          title: 'Noter une idée clé',
          config: {
            criticality: 'l',
            status: 'done',
            recurrenceType: 'monthly',
            alertEnabled: true,
            alertAt: '08:30',
            nextDueAt: new Date().toISOString(),
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      color: 'green',
      visibility: 'private',
      isArchived: false,
      isFavorite: false,
      isLocked: false,
      isAffirmation: false,
      tags: ['routine', 'lecture'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'item_todo_2',
      type: 'todo',
      title: 'Morning routine',
      todoContent: [
        {
          id: 'item_todo_2_sub_1',
          title: 'Réveil sans snooze',
          config: {
            criticality: 'h',
            status: 'done',
            recurrenceType: 'daily',
            alertEnabled: true,
            alertAt: '06:30',
            lastCompletedAt: todayDoneAt.toISOString(),
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'item_todo_2_sub_2',
          title: 'Méditation 10 min',
          config: {
            criticality: 'm',
            status: 'done',
            recurrenceType: 'daily',
            alertEnabled: true,
            alertAt: '06:35',
            lastCompletedAt: todayDoneAt.toISOString(),
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'item_todo_2_sub_3',
          title: 'Petit-déjeuner sain',
          config: {
            criticality: 'm',
            status: 'done',
            recurrenceType: 'daily',
            alertEnabled: false,
            lastCompletedAt: todayDoneAt.toISOString(),
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'item_todo_2_sub_4',
          title: 'Journaling 5 min',
          config: {
            criticality: 'l',
            status: 'done',
            recurrenceType: 'daily',
            alertEnabled: false,
            lastCompletedAt: todayDoneAt.toISOString(),
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'item_todo_2_sub_5',
          title: 'Douche froide',
          config: {
            criticality: 'h',
            status: 'pending',
            recurrenceType: 'daily',
            alertEnabled: false,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      color: 'orange',
      visibility: 'private',
      isArchived: false,
      isFavorite: true,
      isLocked: false,
      isAffirmation: false,
      tags: ['routine', 'matin', 'discipline'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'item_todo_3',
      type: 'todo',
      title: 'Tâches du jour',
      todoContent: [
        {
          id: 'item_todo_3_sub_1',
          title: 'Répondre aux emails importants',
          config: {
            criticality: 'h',
            status: 'done',
            recurrenceType: 'daily',
            alertEnabled: true,
            alertAt: '09:00',
            lastCompletedAt: todayDoneAt.toISOString(),
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'item_todo_3_sub_2',
          title: 'Préparer la réunion de demain',
          config: {
            criticality: 'h',
            status: 'pending',
            recurrenceType: 'none',
            alertEnabled: false,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'item_todo_3_sub_3',
          title: 'Acheter des provisions',
          config: {
            criticality: 'm',
            status: 'pending',
            recurrenceType: 'none',
            alertEnabled: false,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'item_todo_3_sub_4',
          title: 'Appeler maman',
          config: {
            criticality: 'm',
            status: 'pending',
            recurrenceType: 'weekly',
            alertEnabled: true,
            alertAt: '19:00',
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      color: 'blue',
      visibility: 'private',
      isArchived: false,
      isFavorite: false,
      isLocked: false,
      isAffirmation: false,
      tags: ['quotidien', 'tâches'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'item_todo_4',
      type: 'todo',
      title: 'Sport & Fitness',
      todoContent: [
        {
          id: 'item_todo_4_sub_1',
          title: 'Stretching matinal 10 min',
          config: {
            criticality: 'm',
            status: 'done',
            recurrenceType: 'daily',
            alertEnabled: true,
            alertAt: '07:00',
            lastCompletedAt: todayDoneAt.toISOString(),
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'item_todo_4_sub_2',
          title: 'Séance cardio 30 min',
          config: {
            criticality: 'h',
            status: 'done',
            recurrenceType: 'weekly',
            alertEnabled: false,
            lastCompletedAt: thisWeekDoneAt.toISOString(),
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'item_todo_4_sub_3',
          title: 'Séance musculation',
          config: {
            criticality: 'h',
            status: 'pending',
            recurrenceType: 'weekly',
            alertEnabled: false,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      color: 'red',
      visibility: 'private',
      isArchived: false,
      isFavorite: false,
      isLocked: false,
      isAffirmation: false,
      tags: ['sport', 'santé', 'routine'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'item_todo_5',
      type: 'todo',
      title: 'Revue hebdomadaire',
      todoContent: [
        {
          id: 'item_todo_5_sub_1',
          title: 'Bilan de la semaine écoulée',
          config: {
            criticality: 'm',
            status: 'done',
            recurrenceType: 'weekly',
            alertEnabled: true,
            alertAt: '18:00',
            lastCompletedAt: thisWeekDoneAt.toISOString(),
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'item_todo_5_sub_2',
          title: 'Planifier les objectifs de la semaine prochaine',
          config: {
            criticality: 'h',
            status: 'pending',
            recurrenceType: 'weekly',
            alertEnabled: false,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'item_todo_5_sub_3',
          title: 'Nettoyer et organiser les notes',
          config: {
            criticality: 'l',
            status: 'done',
            recurrenceType: 'weekly',
            alertEnabled: false,
            lastCompletedAt: thisWeekDoneAt.toISOString(),
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      color: 'purple',
      visibility: 'private',
      isArchived: false,
      isFavorite: false,
      isLocked: false,
      isAffirmation: false,
      tags: ['planning', 'hebdomadaire', 'organisation'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'item_citation_1',
      type: 'citation',
      content: 'La discipline est une forme d’amour envers ton futur toi.',
      color: 'yellow',
      visibility: 'private',
      isArchived: false,
      isFavorite: true,
      isLocked: false,
      isAffirmation: false,
      tags: ['discipline', 'mindset'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'item_citation_2',
      type: 'citation',
      content: "Le succès, c'est tomber sept fois et se relever huit.",
      color: 'orange',
      visibility: 'private',
      isArchived: false,
      isFavorite: false,
      isLocked: false,
      isAffirmation: false,
      tags: ['résilience', 'mindset'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'item_citation_3',
      type: 'citation',
      content:
        'Chaque matin, tu as le choix de continuer à dormir avec tes rêves, ou de te lever et de les réaliser.',
      color: 'pink',
      visibility: 'private',
      isArchived: false,
      isFavorite: true,
      isLocked: false,
      isAffirmation: true,
      tags: ['motivation', 'matin'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    // {
    //   id: "item_image_1",
    //   type: "image",
    //   title: "Image motivation",
    //   content: "Lever de soleil en montagne",
    //   color: "default",
    //   visibility: "private",
    //   isArchived: false,
    //   isFavorite: false,
    //   tags: ["motivation", "vision-board"],
    //   coverImageUrl: "/images/sunrise.jpg",
    //   createdAt: new Date().toISOString(),
    //   updatedAt: new Date().toISOString(),
    // },
  ],

  todoHistory: [
    ...[
      todayDoneAt,
      yesterdayDoneAt,
      atDaysAgo(2, 8, 12),
      atDaysAgo(4, 8, 4),
      atDaysAgo(6, 8, 21),
      atDaysAgo(8, 7, 58),
      atDaysAgo(10, 8, 16),
      atDaysAgo(13, 8, 9),
    ].map((completedAt, index) =>
      createHistoryEntry(`history_${index + 1}`, 'item_todo_1_sub_1', completedAt)
    ),

    ...[
      atWeeksAgo(0, 2, 10, 15),
      atWeeksAgo(1, 3, 10, 8),
      atWeeksAgo(2, 2, 10, 20),
      atWeeksAgo(4, 1, 9, 55),
      atWeeksAgo(6, 2, 10, 5),
    ].map((completedAt, index) =>
      createHistoryEntry(`history_${index + 9}`, 'item_todo_1_sub_2', completedAt)
    ),

    ...[atMonthsAgo(0, 4, 7, 50), atMonthsAgo(1, 28, 7, 42), atMonthsAgo(2, 30, 7, 47)].map(
      (completedAt, index) =>
        createHistoryEntry(`history_${index + 14}`, 'item_todo_1_sub_3', completedAt)
    ),

    ...[
      atDaysAgo(0, 6, 28),
      atDaysAgo(1, 6, 31),
      atDaysAgo(2, 6, 34),
      atDaysAgo(3, 6, 29),
      atDaysAgo(4, 6, 33),
      atDaysAgo(6, 6, 27),
      atDaysAgo(8, 6, 30),
      atDaysAgo(10, 6, 35),
      atDaysAgo(12, 6, 26),
      atDaysAgo(14, 6, 32),
    ].map((completedAt, index) =>
      createHistoryEntry(`history_${index + 17}`, 'item_todo_2_sub_1', completedAt)
    ),

    ...[
      atDaysAgo(0, 6, 41),
      atDaysAgo(1, 6, 40),
      atDaysAgo(2, 6, 44),
      atDaysAgo(4, 6, 39),
      atDaysAgo(5, 6, 46),
      atDaysAgo(7, 6, 42),
      atDaysAgo(9, 6, 38),
    ].map((completedAt, index) =>
      createHistoryEntry(`history_${index + 27}`, 'item_todo_2_sub_2', completedAt)
    ),

    ...[
      atDaysAgo(0, 7, 12),
      atDaysAgo(1, 7, 18),
      atDaysAgo(3, 7, 5),
      atDaysAgo(4, 7, 9),
      atDaysAgo(6, 7, 16),
    ].map((completedAt, index) =>
      createHistoryEntry(`history_${index + 34}`, 'item_todo_2_sub_3', completedAt)
    ),

    ...[atDaysAgo(0, 7, 25), atDaysAgo(2, 7, 21), atDaysAgo(5, 7, 29)].map((completedAt, index) =>
      createHistoryEntry(`history_${index + 39}`, 'item_todo_2_sub_4', completedAt)
    ),

    ...[
      atDaysAgo(0, 9, 18),
      atDaysAgo(1, 9, 24),
      atDaysAgo(3, 9, 11),
      atDaysAgo(6, 9, 8),
      atDaysAgo(8, 9, 20),
    ].map((completedAt, index) =>
      createHistoryEntry(`history_${index + 42}`, 'item_todo_3_sub_1', completedAt)
    ),

    ...[atWeeksAgo(1, 5, 19, 2), atWeeksAgo(3, 5, 19, 8), atWeeksAgo(5, 5, 18, 55)].map(
      (completedAt, index) =>
        createHistoryEntry(`history_${index + 47}`, 'item_todo_3_sub_4', completedAt)
    ),

    ...[
      atDaysAgo(0, 7, 3),
      atDaysAgo(1, 7, 7),
      atDaysAgo(2, 7, 0),
      atDaysAgo(3, 7, 4),
      atDaysAgo(5, 6, 58),
      atDaysAgo(6, 7, 9),
      atDaysAgo(8, 7, 2),
    ].map((completedAt, index) =>
      createHistoryEntry(`history_${index + 50}`, 'item_todo_4_sub_1', completedAt)
    ),

    ...[
      atWeeksAgo(0, 2, 18, 20),
      atWeeksAgo(1, 2, 18, 5),
      atWeeksAgo(2, 3, 18, 12),
      atWeeksAgo(4, 1, 18, 0),
    ].map((completedAt, index) =>
      createHistoryEntry(`history_${index + 57}`, 'item_todo_4_sub_2', completedAt)
    ),

    ...[
      atWeeksAgo(0, 4, 18, 0),
      atWeeksAgo(1, 4, 18, 7),
      atWeeksAgo(2, 4, 17, 52),
      atWeeksAgo(3, 4, 18, 9),
      atWeeksAgo(5, 4, 17, 58),
    ].map((completedAt, index) =>
      createHistoryEntry(`history_${index + 61}`, 'item_todo_5_sub_1', completedAt)
    ),

    ...[atWeeksAgo(0, 4, 18, 32), atWeeksAgo(2, 4, 18, 25), atWeeksAgo(4, 4, 18, 29)].map(
      (completedAt, index) =>
        createHistoryEntry(`history_${index + 66}`, 'item_todo_5_sub_3', completedAt)
    ),
  ],

  citationsMeta: [
    {
      id: 'citation_meta_1',
      itemId: 'item_citation_1',
      author: 'Unknown',
      source: 'Perso',
    },
    {
      id: 'citation_meta_2',
      itemId: 'item_citation_2',
      author: 'Proverbe japonais',
      source: 'Tradition',
    },
    {
      id: 'citation_meta_3',
      itemId: 'item_citation_3',
      author: 'Unknown',
      source: 'Perso',
    },
  ],

  imagesMeta: [
    // {
    //   id: "image_meta_1",
    //   itemId: "item_image_1",
    //   imageUrl: "/images/sunrise.jpg",
    //   thumbnailUrl: "/images/sunrise-thumb.jpg",
    //   width: 1200,
    //   height: 800,
    //   alt: "Lever de soleil",
    // },
  ],

  settings: {
    id: 'main',
    version: 1,
    theme: 'system',
    language: 'fr',
    dailyAffirmationEnabled: true,
    showArchivedItems: false,
    passwordHash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    userName: 'Nico test',
    userId: 'user_123',
    backupState: {
      lastBackupAt: undefined,
      status: 'idle',
      lastError: undefined,
    },
  },
};
