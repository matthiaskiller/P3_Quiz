const Sequelize = require('sequelize');
const {models} = require('./model');
const {log, biglog, errorlog, colorize} = require('./out');

exports.helpCmd = rl => {
  log("Commandos:");
  log("  h|help - Muestra esta ayuda.");
  log("  list - Listar los quizzes existentes.");
  log("  show <id> - Muestra la pregunta y la respuesta el quiz indicado.");
  log("  add - Añadir un nuevo quiz interactivamente.");
  log("  delete <id> - Borrar el quiz indicado.");
  log("  edit <id> - Editar el quiz indicado.");
  log("  test <id> - Probar el quiz indicado.");
  log("  p|play - Jugar a preguntar aleatoriamente todos los quizzes.");
  log("  credits - Créditos.");
  log("  q|quit - Salir del programa.");
  rl.prompt();
};


exports.listCmd = rl => {

  models.quiz.findAll()
  .each(quiz => {
      log(`[${colorize(quiz.id, 'magenta')}]: ${quiz.question}`);
  })
  .catch(error => {
    errorlog(error.message);
  })
  .then(() => {
    rl.prompt();
  });

};

const validateId = id => {

    return new Sequelize.Promise((resolve, reject) => {
      if(typeof id === "undefined") {
        reject(new Error (`Falta el parámetro <id>.`));
      }
      else {
        id = parseInt(id);
        if(Number.isNaN(id)) {
          reject(new Error (`El valor del parámetro <id> no es un número.`));
        }
        else {
          resolve(id);
        }
      }
    });
};


exports.showCmd = (rl, id) => {

  validateId(id)
  .then (id => models.quiz.findById(id))
  .then(quiz => {
    if(!quiz) {
      throw new Error(`No existe un quiz asociado al id=${id}.`);
    }
    log(` [${colorize(quiz.id,'magenta')}]: ${quiz.question} ${colorize('=>','magenta')} ${quiz.answer} `)
  })
  .catch(error => {
    errorlog(error.message);
  })
  .then(() => {
    rl.prompt();
  });

};


const makeQuestion = (rl,text) => {
  return new Sequelize.Promise((resolve, reject) => {
    rl.question(colorize(text, 'red'), answer => {
      resolve(answer.trim());
    });
  });
};

exports.addCmd = rl => {

  makeQuestion(rl, 'Introduzca una pregunta:  ')
  .then(q => {
    return makeQuestion(rl, 'Introduzca la repuesta:  ')
    .then(a => {
      return{question: q, answer: a};
    });
  })
  .then(quiz => {
    return models.quiz.create(quiz);
  })
  .then((quiz) => {
    log(` ${colorize('Se ha añadido', 'magenta')}: ${quiz.question}  ${colorize('=>', 'magenta')} ${quiz.answer}`);
  })
  .catch(Sequelize.ValidationError, error => {
    errorlog('El quiz es un erroneo: ');
    error.errors.forEach(({message}) => errorlog(message));
  })
  .catch(error => {
    errorlog(error.message);
  })
  .then(() => {
    rl.prompt();
  });

};

exports.deleteCmd = (rl, id) => {

  validateId(id)
  .then(id => models.quiz.destroy({where: {id}}))
  .catch(error => {
    errorlog(error.message);
  })
  .then(() => {
    rl.prompt();
  });

};

exports.editCmd = (rl, id) => {

  validateId(id)
  .then(id => models.quiz.findById(id))
  .then(quiz => {
    if(!quiz) {
      throw new Error(`No existe un quiz asociado al id=${id}.`);
    }

    process.stdout.isTTY && setTimeout(() => {rl.write(quiz.question)},0);
    return makeQuestion(rl, 'Introduzca la pregunta:  ')
    .then(q => {
      process.stdout.isTTY && setTimeout(() => {rl.write(quiz.answer)},0);
      return makeQuestion(rl,'Introduzca la repuesta:  ')
      .then(a => {
        quiz.question = q;
        quiz.answer = a;
        return quiz;
      });
    });
  })
  .then(quiz => {
    return quiz.save();
  })
  .then(quiz => {
    log(` Se ha cambiado el quiz ${colorize(quiz.id, 'magenta')} por: ${quiz.question}  ${colorize('=>', 'magenta')} ${quiz.answer}`);
  })
  .catch(Sequelize.ValidationError, error => {
    errorlog('El quiz es un erroneo: ');
    error.errors.forEach(({message}) => errorlog(message));
  })
  .catch(error => {
    errorlog(error.message);
  })
  .then(() => {
    rl.prompt();
  });


};

exports.testCmd = (rl, id) => {

  validateId(id)
  .then(id => models.quiz.findById(id))
  .then(quiz => {
    if(!quiz) {
      throw new Error(`No existe un quiz asociado al id=${id}.`);
    }
    rl.question(colorize(quiz.question +  '? ', 'red'), (answer) => {

      log(`Su respuesta es:\n`);

      if(answer.trim().toUpperCase() === quiz.answer.toUpperCase()) {
        biglog('Correcta', 'green');
      }
      else {
        biglog('Incorrecta', 'red');
      }
      rl.prompt();
    })
  })
  .catch(error => {
    errorlog(error.message);
  })
  .then(() => {
    rl.prompt();
  });
};

exports.playCmd = rl => {

  let score = 0;
  let numberOfQuestions = 0;
  let toBeResolved = [];

  models.quiz.findAll()
  .then(quiz => {
    quiz.forEach(entrance => {
      toBeResolved[numberOfQuestions] = entrance.id;
      numberOfQuestions++;
    })
    const playOne = () => {
      if (toBeResolved === undefined || toBeResolved.length == 0) {
        log(`No hay nada más que preguntar.`);
        log(`Fin del examen. Aciertos:\n`);
        biglog(score, 'magenta');
        rl.prompt();
      }
      else {
        let id = Math.floor(Math.random() * numberOfQuestions);
        validateId(id)
        .then(id => models.quiz.findById(toBeResolved[id]))
        .then(quiz => {

          if (id > -1) {
          toBeResolved.splice(id, 1);
          numberOfQuestions--;
          }

          rl.question(colorize(quiz.question +  '? ', 'red'), (answer) => {

            if(answer.trim().toUpperCase() === quiz.answer.toUpperCase()) {
              score++;
              log(`CORRECTO - Lleva ${score} aciertos`);
              playOne();
            }
            else {
              log(`INCORRECTO.\nFin del examen. Aciertos:\n`);
              biglog(score, 'magenta');
              rl.prompt();
            }
          });
        })
      }
    }
    playOne();

  })
  .catch(error => {
    errorlog(error.message);
  })
  .then(() => {
    rl.prompt();
  });


};

exports.creditsCmd = rl => {
  log('Autor de la práctica:');
  log('Matthias Killer','green');
  rl.prompt();
};

exports.quitCmd = rl => {
  rl.close();
};
