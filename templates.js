// Утверждённые блоки и точные списки разрешённых вариантов из training-data.md.
// allowedExerciseIds включает исходное упражнение, чтобы к нему можно было вернуться.
(function () {
  "use strict";
  const templates = [
  {
    "id": "block1",
    "number": 1,
    "name": "Ноги + плечи",
    "focus": "квадрицепсы",
    "description": "Три упражнения на ноги, два на плечи, одно на пресс.",
    "positions": [
      {
        "positionId": "block1-position1",
        "defaultExerciseId": "ex001",
        "allowedExerciseIds": [
          "ex001",
          "ex003",
          "ex004",
          "ex005",
          "ex006",
          "ex002"
        ],
        "purpose": "Основное квадрицепс-доминантное движение"
      },
      {
        "positionId": "block1-position2",
        "defaultExerciseId": "ex041",
        "allowedExerciseIds": [
          "ex041",
          "ex040",
          "ex039"
        ],
        "purpose": "Вертикальный жим на плечи"
      },
      {
        "positionId": "block1-position3",
        "defaultExerciseId": "ex055",
        "allowedExerciseIds": [
          "ex055",
          "ex056",
          "ex057"
        ],
        "purpose": "Мышцы корпуса"
      },
      {
        "positionId": "block1-position4",
        "defaultExerciseId": "ex014",
        "allowedExerciseIds": [
          "ex014"
        ],
        "purpose": "Изолированное разгибание колена: фиксированная позиция"
      },
      {
        "positionId": "block1-position5",
        "defaultExerciseId": "ex044",
        "allowedExerciseIds": [
          "ex044",
          "ex045"
        ],
        "purpose": "Отведение плеча: средние дельты"
      },
      {
        "positionId": "block1-position6",
        "defaultExerciseId": "ex009",
        "allowedExerciseIds": [
          "ex009",
          "ex008",
          "ex010",
          "ex011"
        ],
        "purpose": "Одностороннее движение для ног"
      }
    ]
  },
  {
    "id": "block2",
    "number": 2,
    "name": "Спина + грудь",
    "focus": "мышцы спины и груди",
    "description": "Две тяги, два жима, бицепс и трицепс.",
    "positions": [
      {
        "positionId": "block2-position1",
        "defaultExerciseId": "ex024",
        "allowedExerciseIds": [
          "ex024",
          "ex028",
          "ex026",
          "ex027",
          "ex025"
        ],
        "purpose": "Горизонтальная тяга"
      },
      {
        "positionId": "block2-position2",
        "defaultExerciseId": "ex031",
        "allowedExerciseIds": [
          "ex031",
          "ex032",
          "ex033",
          "ex035"
        ],
        "purpose": "Горизонтальный жим"
      },
      {
        "positionId": "block2-position3",
        "defaultExerciseId": "ex022",
        "allowedExerciseIds": [
          "ex022",
          "ex019",
          "ex020",
          "ex021",
          "ex023"
        ],
        "purpose": "Вертикальная тяга"
      },
      {
        "positionId": "block2-position4",
        "defaultExerciseId": "ex034",
        "allowedExerciseIds": [
          "ex034",
          "ex037"
        ],
        "purpose": "Жим с акцентом на ключичную часть груди"
      },
      {
        "positionId": "block2-position5",
        "defaultExerciseId": "ex048",
        "allowedExerciseIds": [
          "ex048",
          "ex047",
          "ex050",
          "ex049"
        ],
        "purpose": "Сгибание локтя"
      },
      {
        "positionId": "block2-position6",
        "defaultExerciseId": "ex052",
        "allowedExerciseIds": [
          "ex052",
          "ex053",
          "ex054"
        ],
        "purpose": "Разгибание локтя"
      }
    ]
  },
  {
    "id": "block3",
    "number": 3,
    "name": "Ноги + плечи",
    "focus": "задняя поверхность бедра и ягодицы",
    "description": "Три упражнения на ноги, два на плечи, икры.",
    "positions": [
      {
        "positionId": "block3-position1",
        "defaultExerciseId": "ex012",
        "allowedExerciseIds": [
          "ex012",
          "ex013"
        ],
        "purpose": "Тазовый шарнир"
      },
      {
        "positionId": "block3-position2",
        "defaultExerciseId": "ex039",
        "allowedExerciseIds": [
          "ex039",
          "ex040",
          "ex041"
        ],
        "purpose": "Вертикальный жим на плечи"
      },
      {
        "positionId": "block3-position3",
        "defaultExerciseId": "ex017",
        "allowedExerciseIds": [
          "ex017",
          "ex018"
        ],
        "purpose": "Подошвенное сгибание стопы"
      },
      {
        "positionId": "block3-position4",
        "defaultExerciseId": "ex015",
        "allowedExerciseIds": [
          "ex015",
          "ex016"
        ],
        "purpose": "Сгибание колена: выбор сидя/лёжа"
      },
      {
        "positionId": "block3-position5",
        "defaultExerciseId": "ex046",
        "allowedExerciseIds": [
          "ex046",
          "ex030"
        ],
        "purpose": "Задние дельты"
      },
      {
        "positionId": "block3-position6",
        "defaultExerciseId": "ex007",
        "allowedExerciseIds": [
          "ex007",
          "ex009",
          "ex010",
          "ex011"
        ],
        "purpose": "Одностороннее движение для ног"
      }
    ]
  },
  {
    "id": "block4",
    "number": 4,
    "name": "Спина + грудь",
    "focus": "мышцы спины и груди",
    "description": "Вертикальная и горизонтальная тяги, два жимовых движения, трицепс и бицепс.",
    "positions": [
      {
        "positionId": "block4-position1",
        "defaultExerciseId": "ex020",
        "allowedExerciseIds": [
          "ex020",
          "ex019",
          "ex022",
          "ex021",
          "ex023"
        ],
        "purpose": "Вертикальная тяга"
      },
      {
        "positionId": "block4-position2",
        "defaultExerciseId": "ex032",
        "allowedExerciseIds": [
          "ex032",
          "ex031",
          "ex033",
          "ex035"
        ],
        "purpose": "Горизонтальный жим"
      },
      {
        "positionId": "block4-position3",
        "defaultExerciseId": "ex028",
        "allowedExerciseIds": [
          "ex028",
          "ex026",
          "ex027",
          "ex025",
          "ex024"
        ],
        "purpose": "Горизонтальная тяга"
      },
      {
        "positionId": "block4-position4",
        "defaultExerciseId": "ex037",
        "allowedExerciseIds": [
          "ex037",
          "ex034"
        ],
        "purpose": "Жим с акцентом на ключичную часть груди"
      },
      {
        "positionId": "block4-position5",
        "defaultExerciseId": "ex054",
        "allowedExerciseIds": [
          "ex054",
          "ex053",
          "ex052"
        ],
        "purpose": "Разгибание локтя"
      },
      {
        "positionId": "block4-position6",
        "defaultExerciseId": "ex049",
        "allowedExerciseIds": [
          "ex049",
          "ex048",
          "ex047",
          "ex050"
        ],
        "purpose": "Сгибание локтя"
      }
    ]
  }
];
  templates.forEach(template => {
    template.positions.forEach(position => {
      Object.freeze(position.allowedExerciseIds);
      Object.freeze(position);
    });
    Object.freeze(template.positions);
    Object.freeze(template);
  });
  window.WorkoutTemplates = Object.freeze(templates);
})();
