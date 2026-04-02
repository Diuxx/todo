import { AppData } from "./app-data.model";

export const appDataExample: AppData = {
  id: "example_data_1",
  items: [
    {
      id: "item_note_1",
      type: "note",
      title: "Mes idées du matin",
      content: "Créer une app qui regroupe notes, motivation et discipline.",
      color: "blue",
      visibility: "private",
      isArchived: false,
      isFavorite: true,
      tags: ["vision", "projet"],
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
          title: "Choisir un livre",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "item_todo_1_sub_2",
          title: "Lire au moins 30 minutes",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "item_todo_1_sub_3",
          title: "Noter une idée clé",
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
      id: "item_image_1",
      type: "image",
      title: "Image motivation",
      content: "Lever de soleil en montagne",
      color: "default",
      visibility: "private",
      isArchived: false,
      isFavorite: false,
      tags: ["motivation", "vision-board"],
      coverImageUrl: "/images/sunrise.jpg",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],

  todoConfigs: [
    {
      itemId: "item_todo_1",
      status: "pending",
      recurrenceType: "daily",
      recurrenceRule: "daily",
      alertEnabled: true,
      alertAt: "08:00",
      nextDueAt: new Date().toISOString(),
    },
    {
      itemId: "item_todo_1_sub_1",
      status: "done",
      recurrenceType: "none",
      alertEnabled: false,
      lastCompletedAt: new Date().toISOString(),
    },
    {
      itemId: "item_todo_1_sub_2",
      status: "pending",
      recurrenceType: "none",
      alertEnabled: true,
      alertAt: "08:30",
      nextDueAt: new Date().toISOString(),
    },
    {
      itemId: "item_todo_1_sub_3",
      status: "pending",
      recurrenceType: "none",
      alertEnabled: false,
      nextDueAt: new Date().toISOString(),
    },
  ],

  todoHistory: [
    {
      id: "history_1",
      todoItemId: "item_todo_1",
      status: "done",
      completedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],

  citationsMeta: [
    {
      itemId: "item_citation_1",
      author: "Unknown",
      source: "Perso",
    },
  ],

  imagesMeta: [
    {
      itemId: "item_image_1",
      imageUrl: "/images/sunrise.jpg",
      thumbnailUrl: "/images/sunrise-thumb.jpg",
      width: 1200,
      height: 800,
      alt: "Lever de soleil",
    },
  ],

  settings: {
    theme: "system",
    language: "fr",
    dailyAffirmationEnabled: true,
    defaultItemColor: "default",
    showArchivedItems: false,
  },
};