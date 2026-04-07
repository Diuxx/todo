import { AppData } from "./app-data.model";

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

export const appDataExample: AppData = {
  id: "example_data_1",
  items: [
    {
      id: "item_note_1",
      type: "note",
      title: "Mes idées du matin",
      content: "Créer une app qui regroupe notes, motivation et discipline. Et un autre texte beaucoup trop long pour etre affiché dans la case. je crois qu'il en faut beaucoup plus pour que ça passe... ah et pas de petits points à la fin ",
      color: "blue",
      visibility: "private",
      isArchived: false,
      isFavorite: true,
      tags: ["vision", "projet"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "item_note_2",
      type: "note",
      title: "Idées pour l'app",
      content: "- Ajouter un mode focus (timer Pomodoro)\n- Intégrer des statistiques de complétion\n- Notifications intelligentes selon l'heure de réveil\n- Widget Android pour cocher les tâches du matin\n- Mode collaboratif pour partager des routines",
      color: "yellow",
      visibility: "private",
      isArchived: false,
      isFavorite: false,
      tags: ["projet", "dev", "idées"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "item_note_3",
      type: "note",
      title: "Objectifs du mois d'avril",
      content: "1. Finir le MVP de l'app avant le 30\n2. Lire 2 livres complets\n3. Courir 3 fois par semaine minimum\n4. Réduire le temps d'écran à moins de 2h/jour\n5. Méditer chaque matin sans exception",
      color: "purple",
      visibility: "private",
      isArchived: false,
      isFavorite: true,
      tags: ["objectifs", "mensuel", "discipline"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "item_todo_1",
      type: "todo",
      title: "Lire 30 minutes",
      todoContent: [
        {
          id: "item_todo_1_sub_1",
          title: "Choisir un livre ete un texte beaucoup trop long pour etre affiché dans la case.",
          config: {
            status: "pending",
            recurrenceType: "daily",
            recurrenceRule: "daily",
            alertEnabled: true,
            alertAt: "08:00",
            nextDueAt: new Date().toISOString(),
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "item_todo_1_sub_2",
          title: "Lire au moins 30 minutes",
          config: {
            status: "done",
            recurrenceType: "weekly",
            alertEnabled: false,
            lastCompletedAt: new Date().toISOString(),
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "item_todo_1_sub_3",
          title: "Noter une idée clé",
          config: {
            status: "done",
            recurrenceType: "monthly",
            alertEnabled: true,
            alertAt: "08:30",
            nextDueAt: new Date().toISOString(),
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      color: "green",
      visibility: "private",
      isArchived: false,
      isFavorite: false,
      tags: ["routine", "lecture"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "item_todo_2",
      type: "todo",
      title: "Morning routine",
      todoContent: [
        {
          id: "item_todo_2_sub_1",
          title: "Réveil sans snooze",
          config: {
            status: "done",
            recurrenceType: "daily",
            alertEnabled: true,
            alertAt: "06:30",
            lastCompletedAt: todayDoneAt.toISOString(),
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "item_todo_2_sub_2",
          title: "Méditation 10 min",
          config: {
            status: "done",
            recurrenceType: "daily",
            alertEnabled: true,
            alertAt: "06:35",
            lastCompletedAt: todayDoneAt.toISOString(),
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "item_todo_2_sub_3",
          title: "Petit-déjeuner sain",
          config: {
            status: "done",
            recurrenceType: "daily",
            alertEnabled: false,
            lastCompletedAt: todayDoneAt.toISOString(),
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "item_todo_2_sub_4",
          title: "Journaling 5 min",
          config: {
            status: "done",
            recurrenceType: "daily",
            alertEnabled: false,
            lastCompletedAt: todayDoneAt.toISOString(),
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "item_todo_2_sub_5",
          title: "Douche froide",
          config: {
            status: "pending",
            recurrenceType: "daily",
            alertEnabled: false,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      color: "orange",
      visibility: "private",
      isArchived: false,
      isFavorite: true,
      tags: ["routine", "matin", "discipline"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "item_todo_3",
      type: "todo",
      title: "Tâches du jour",
      todoContent: [
        {
          id: "item_todo_3_sub_1",
          title: "Répondre aux emails importants",
          config: {
            status: "done",
            recurrenceType: "daily",
            alertEnabled: true,
            alertAt: "09:00",
            lastCompletedAt: todayDoneAt.toISOString(),
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "item_todo_3_sub_2",
          title: "Préparer la réunion de demain",
          config: {
            status: "pending",
            recurrenceType: "none",
            alertEnabled: false,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "item_todo_3_sub_3",
          title: "Acheter des provisions",
          config: {
            status: "pending",
            recurrenceType: "none",
            alertEnabled: false,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "item_todo_3_sub_4",
          title: "Appeler maman",
          config: {
            status: "pending",
            recurrenceType: "weekly",
            alertEnabled: true,
            alertAt: "19:00",
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      color: "blue",
      visibility: "private",
      isArchived: false,
      isFavorite: false,
      tags: ["quotidien", "tâches"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "item_todo_4",
      type: "todo",
      title: "Sport & Fitness",
      todoContent: [
        {
          id: "item_todo_4_sub_1",
          title: "Stretching matinal 10 min",
          config: {
            status: "done",
            recurrenceType: "daily",
            alertEnabled: true,
            alertAt: "07:00",
            lastCompletedAt: todayDoneAt.toISOString(),
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "item_todo_4_sub_2",
          title: "Séance cardio 30 min",
          config: {
            status: "done",
            recurrenceType: "weekly",
            alertEnabled: false,
            lastCompletedAt: thisWeekDoneAt.toISOString(),
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "item_todo_4_sub_3",
          title: "Séance musculation",
          config: {
            status: "pending",
            recurrenceType: "weekly",
            alertEnabled: false,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      color: "red",
      visibility: "private",
      isArchived: false,
      isFavorite: false,
      tags: ["sport", "santé", "routine"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "item_todo_5",
      type: "todo",
      title: "Revue hebdomadaire",
      todoContent: [
        {
          id: "item_todo_5_sub_1",
          title: "Bilan de la semaine écoulée",
          config: {
            status: "done",
            recurrenceType: "weekly",
            alertEnabled: true,
            alertAt: "18:00",
            lastCompletedAt: thisWeekDoneAt.toISOString(),
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "item_todo_5_sub_2",
          title: "Planifier les objectifs de la semaine prochaine",
          config: {
            status: "pending",
            recurrenceType: "weekly",
            alertEnabled: false,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "item_todo_5_sub_3",
          title: "Nettoyer et organiser les notes",
          config: {
            status: "done",
            recurrenceType: "weekly",
            alertEnabled: false,
            lastCompletedAt: thisWeekDoneAt.toISOString(),
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      color: "purple",
      visibility: "private",
      isArchived: false,
      isFavorite: false,
      tags: ["planning", "hebdomadaire", "organisation"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "item_citation_1",
      type: "citation",
      content: "La discipline est une forme d’amour envers ton futur toi.",
      color: "yellow",
      visibility: "private",
      isArchived: false,
      isFavorite: true,
      tags: ["discipline", "mindset"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "item_citation_2",
      type: "citation",
      content: "Le succès, c'est tomber sept fois et se relever huit.",
      color: "orange",
      visibility: "private",
      isArchived: false,
      isFavorite: false,
      tags: ["résilience", "mindset"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "item_citation_3",
      type: "citation",
      content: "Chaque matin, tu as le choix de continuer à dormir avec tes rêves, ou de te lever et de les réaliser.",
      color: "pink",
      visibility: "private",
      isArchived: false,
      isFavorite: true,
      tags: ["motivation", "matin"],
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
    {
      id: "history_1",
      todoItemId: "item_todo_1_sub_1",
      status: "done",
      completedAt: todayDoneAt.toISOString(),
      createdAt: todayDoneAt.toISOString(),
      updatedAt: todayDoneAt.toISOString(),
    },
    {
      id: "history_2",
      todoItemId: "item_todo_1_sub_1",
      status: "done",
      completedAt: yesterdayDoneAt.toISOString(),
      createdAt: yesterdayDoneAt.toISOString(),
      updatedAt: yesterdayDoneAt.toISOString(),
    },
    {
      id: "history_3",
      todoItemId: "item_todo_1_sub_2",
      status: "done",
      completedAt: thisWeekDoneAt.toISOString(),
      createdAt: thisWeekDoneAt.toISOString(),
      updatedAt: thisWeekDoneAt.toISOString(),
    },
    {
      id: "history_4",
      todoItemId: "item_todo_1_sub_2",
      status: "done",
      completedAt: lastWeekDoneAt.toISOString(),
      createdAt: lastWeekDoneAt.toISOString(),
      updatedAt: lastWeekDoneAt.toISOString(),
    },
    {
      id: "history_5",
      todoItemId: "item_todo_1_sub_3",
      status: "done",
      completedAt: thisMonthDoneAt.toISOString(),
      createdAt: thisMonthDoneAt.toISOString(),
      updatedAt: thisMonthDoneAt.toISOString(),
    },
    {
      id: "history_6",
      todoItemId: "item_todo_1_sub_3",
      status: "done",
      completedAt: lastMonthDoneAt.toISOString(),
      createdAt: lastMonthDoneAt.toISOString(),
      updatedAt: lastMonthDoneAt.toISOString(),
    },
    // Morning routine — sub_1 (Réveil sans snooze) : streak 4 jours
    {
      id: "history_7",
      todoItemId: "item_todo_2_sub_1",
      status: "done",
      completedAt: todayDoneAt.toISOString(),
      createdAt: todayDoneAt.toISOString(),
      updatedAt: todayDoneAt.toISOString(),
    },
    {
      id: "history_8",
      todoItemId: "item_todo_2_sub_1",
      status: "done",
      completedAt: yesterdayDoneAt.toISOString(),
      createdAt: yesterdayDoneAt.toISOString(),
      updatedAt: yesterdayDoneAt.toISOString(),
    },
    {
      id: "history_9",
      todoItemId: "item_todo_2_sub_1",
      status: "done",
      completedAt: twoDaysAgoDoneAt.toISOString(),
      createdAt: twoDaysAgoDoneAt.toISOString(),
      updatedAt: twoDaysAgoDoneAt.toISOString(),
    },
    {
      id: "history_10",
      todoItemId: "item_todo_2_sub_1",
      status: "done",
      completedAt: threeDaysAgoDoneAt.toISOString(),
      createdAt: threeDaysAgoDoneAt.toISOString(),
      updatedAt: threeDaysAgoDoneAt.toISOString(),
    },
    // Morning routine — sub_2 (Méditation) : streak 3 jours
    {
      id: "history_11",
      todoItemId: "item_todo_2_sub_2",
      status: "done",
      completedAt: todayDoneAt.toISOString(),
      createdAt: todayDoneAt.toISOString(),
      updatedAt: todayDoneAt.toISOString(),
    },
    {
      id: "history_12",
      todoItemId: "item_todo_2_sub_2",
      status: "done",
      completedAt: yesterdayDoneAt.toISOString(),
      createdAt: yesterdayDoneAt.toISOString(),
      updatedAt: yesterdayDoneAt.toISOString(),
    },
    {
      id: "history_13",
      todoItemId: "item_todo_2_sub_2",
      status: "done",
      completedAt: twoDaysAgoDoneAt.toISOString(),
      createdAt: twoDaysAgoDoneAt.toISOString(),
      updatedAt: twoDaysAgoDoneAt.toISOString(),
    },
    // Morning routine — sub_3 (Petit-déjeuner) : streak 2 jours
    {
      id: "history_14",
      todoItemId: "item_todo_2_sub_3",
      status: "done",
      completedAt: todayDoneAt.toISOString(),
      createdAt: todayDoneAt.toISOString(),
      updatedAt: todayDoneAt.toISOString(),
    },
    {
      id: "history_15",
      todoItemId: "item_todo_2_sub_3",
      status: "done",
      completedAt: yesterdayDoneAt.toISOString(),
      createdAt: yesterdayDoneAt.toISOString(),
      updatedAt: yesterdayDoneAt.toISOString(),
    },
    // Morning routine — sub_4 (Journaling) : aujourd'hui seulement
    {
      id: "history_16",
      todoItemId: "item_todo_2_sub_4",
      status: "done",
      completedAt: todayDoneAt.toISOString(),
      createdAt: todayDoneAt.toISOString(),
      updatedAt: todayDoneAt.toISOString(),
    },
    // Tâches du jour — sub_1 (Emails) : 2 jours
    {
      id: "history_17",
      todoItemId: "item_todo_3_sub_1",
      status: "done",
      completedAt: todayDoneAt.toISOString(),
      createdAt: todayDoneAt.toISOString(),
      updatedAt: todayDoneAt.toISOString(),
    },
    {
      id: "history_18",
      todoItemId: "item_todo_3_sub_1",
      status: "done",
      completedAt: yesterdayDoneAt.toISOString(),
      createdAt: yesterdayDoneAt.toISOString(),
      updatedAt: yesterdayDoneAt.toISOString(),
    },
    // Sport — sub_1 (Stretching) : 2 jours
    {
      id: "history_19",
      todoItemId: "item_todo_4_sub_1",
      status: "done",
      completedAt: todayDoneAt.toISOString(),
      createdAt: todayDoneAt.toISOString(),
      updatedAt: todayDoneAt.toISOString(),
    },
    {
      id: "history_20",
      todoItemId: "item_todo_4_sub_1",
      status: "done",
      completedAt: yesterdayDoneAt.toISOString(),
      createdAt: yesterdayDoneAt.toISOString(),
      updatedAt: yesterdayDoneAt.toISOString(),
    },
    // Sport — sub_2 (Cardio) : cette semaine + semaine dernière
    {
      id: "history_21",
      todoItemId: "item_todo_4_sub_2",
      status: "done",
      completedAt: thisWeekDoneAt.toISOString(),
      createdAt: thisWeekDoneAt.toISOString(),
      updatedAt: thisWeekDoneAt.toISOString(),
    },
    {
      id: "history_22",
      todoItemId: "item_todo_4_sub_2",
      status: "done",
      completedAt: lastWeekDoneAt.toISOString(),
      createdAt: lastWeekDoneAt.toISOString(),
      updatedAt: lastWeekDoneAt.toISOString(),
    },
    // Revue hebdo — sub_1 (Bilan) : cette semaine + semaine dernière
    {
      id: "history_23",
      todoItemId: "item_todo_5_sub_1",
      status: "done",
      completedAt: thisWeekDoneAt.toISOString(),
      createdAt: thisWeekDoneAt.toISOString(),
      updatedAt: thisWeekDoneAt.toISOString(),
    },
    {
      id: "history_24",
      todoItemId: "item_todo_5_sub_1",
      status: "done",
      completedAt: lastWeekDoneAt.toISOString(),
      createdAt: lastWeekDoneAt.toISOString(),
      updatedAt: lastWeekDoneAt.toISOString(),
    },
    // Revue hebdo — sub_3 (Nettoyer notes) : cette semaine
    {
      id: "history_25",
      todoItemId: "item_todo_5_sub_3",
      status: "done",
      completedAt: thisWeekDoneAt.toISOString(),
      createdAt: thisWeekDoneAt.toISOString(),
      updatedAt: thisWeekDoneAt.toISOString(),
    },
  ],

  citationsMeta: [
    {
      itemId: "item_citation_1",
      author: "Unknown",
      source: "Perso",
    },
    {
      itemId: "item_citation_2",
      author: "Proverbe japonais",
      source: "Tradition",
    },
    {
      itemId: "item_citation_3",
      author: "Unknown",
      source: "Perso",
    },
  ],

  imagesMeta: [
    // {
    //   itemId: "item_image_1",
    //   imageUrl: "/images/sunrise.jpg",
    //   thumbnailUrl: "/images/sunrise-thumb.jpg",
    //   width: 1200,
    //   height: 800,
    //   alt: "Lever de soleil",
    // },
  ],

  settings: {
    id: "main",
    theme: "system",
    language: "fr",
    dailyAffirmationEnabled: true,
    showArchivedItems: false,
    userName: "Nico test",
    userId: "user_123",
  },
};