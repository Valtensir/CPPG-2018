'use strict';
var path = require('path');
var express = require('express');
var router = express.Router();
var tagCloud = require('tag-cloud');
var sort = require('srtr');
var vars = require('../model/variables.js');
var proceeding = require('../model/functions.js');
var base64 = require('base-64');
var fs = require('fs');

router.get('/', function(req, res, next){
	try
	{
		if(vars.con.state === 'disconnected'){
			vars.con.connect(function(err) {
				if (err) throw err;
			});
		}

		getAssistanceChartData();
	}
	catch(e)
	{
		throw e;
	}

	function lookForProjectsPerYear(actualYear, countYears, typesOfAssistance)
	{
		var sql = "SELECT AP.modalidadeBolsa AS tipoBolsa FROM aluno_participa_projeto AP JOIN projeto P ON P.idProjeto = AP.idProjeto WHERE P.anoEdital = ?";

		typesOfAssistance[countYears] = [0, 0, 0, 0, 0];
		
		return new Promise(function(resolve,reject)
		{
			vars.con.query(sql, [actualYear], function (er, result, fields)
			{
				if(er) return reject(er);
				for(var j = 0; j<result.length; j++)
				{
					if(result[j].tipoBolsa == "PIBIC")
					{
						typesOfAssistance[countYears][0]++;
					}
					else if(result[j].tipoBolsa == "PIBIC-JR")
					{
						typesOfAssistance[countYears][1]++;
					}
					else if(result[j].tipoBolsa == "PIBIT")
					{
						typesOfAssistance[countYears][2]++;
					}
					else if(result[j].tipoBolsa == "PIBEX")
					{
						typesOfAssistance[countYears][3]++;
					}
					else
					{
						typesOfAssistance[countYears][4]++;
					}
				}
				resolve(typesOfAssistance);
			});
		});
	}

	function getCol(matrix, col)
	{
		var column = [];
		for(var i=0; i<matrix.length; i++){
			column.push(matrix[i][col]);
		}
		return column;
	}

	function sendToView(years, typesOfAssistance)
	{
		var pibicAssistance 	= getCol(typesOfAssistance, 0);
		var pibicJrAssistance 	= getCol(typesOfAssistance, 1);
		var pibitAssistance 	= getCol(typesOfAssistance, 2);
		var pibexAssistance 	= getCol(typesOfAssistance, 3);
		var volunteerAssistance = getCol(typesOfAssistance, 4);

		var yearData = [];
		for(var i=(years.length-1); i>=0; i--)
		{
			yearData.push(years[i].anoEdital);
		}

		getKeywordsCloud().then(function(cloud)
		{
			tagCloud.tagCloud(cloud, function (err, data) {
				res.render('index', {
					cloud: data,
					years: yearData,
					pibicAssistance: pibicAssistance,
					pibicJrAssistance: pibicJrAssistance,
					pibitAssistance: pibitAssistance,
					pibexAssistance: pibexAssistance,
					volunteerAssistance: volunteerAssistance
				});
			}, {
				classPrefix: 'btn tag tag',
				randomize: false,
				numBuckets: 5,
				htmlTag: 'a',
				additionalAttributes: {href: vars.config.url +'/keyword={{tag}}'}
			});
		}).catch((err) => setImmediate(() => { throw err; }));
	}

	function getKeywordsCloud()
	{
		try
		{
			var sql = "SELECT palavra AS keyword, COUNT(*) AS totalUsage FROM palavras_chave_publicacao GROUP BY palavra";
			var keywordsByUse = [];
			return new Promise(function(resolve, reject)
			{
				vars.con.query(sql, function (err, results, fields)
				{
					var cloud = [];
					results.forEach(function(result)
					{
						cloud.push({
							tagName: result["keyword"], count: result["totalUsage"]
						});
					});
					var sorted = sort.quicksort(cloud, (a, b) => b.count - a.count);
					resolve(sorted);
				});
			});
		}
		catch(err)
		{
			throw err;
		}
	}

	function getAssistanceChartData()
	{
		// Recupera os três últimos anos nos quais hajam dados no banco
		var sql = "SELECT anoEdital FROM aluno_participa_projeto AP JOIN projeto P ON P.idProjeto = AP.idProjeto GROUP BY P.anoEdital ORDER BY P.anoEdital DESC";

		vars.con.query(sql, function (er, result, fields)
		{
			if (er) throw er;
			else
			{
				var years = result;
				var numberOfYears = 0;
				var conta=[];
				var typesOfAssistance = [];

				for(var i=0; i<years.length; i++)
				{
					lookForProjectsPerYear(years[i].anoEdital, numberOfYears, typesOfAssistance).then(function()
					{
						conta.push(1);

						// Se já rodei todas as promises, mando pra view
						if(conta.length == years.length)
						{
							sendToView(years,typesOfAssistance);
						}
					}).catch((err) => setImmediate(() => { throw err; }));
					numberOfYears++;
				}
			}
		});
	}
});

function base64_encode(file) {
    // read binary data
    var bitmap = fs.readFileSync(file);
    // convert binary data to base64 encoded string
    return new Buffer(bitmap).toString('base64');
}

/* DOCUMENTAÇÃO DA API https://www.npmjs.com/package/tag-cloud */
router.get('/pdf', function(req, res, next) {
	try
	{
		global.atob = require("atob");
		global.window = {document: {createElementNS: () => {return {}} }};
		global.navigator = {};
		global.btoa = () => {};
		
		//var imgData = 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs';
		//var imgData = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AI5AB//Z';
		// res.send(imgData);

		var PDF = require('pdfkit');
		var text = 'ANY_TEXT_YOU_WANT_TO_WRITE_IN_PDF_DOC';        //define a dummy text to be written in the file
		var request = require('request');		

		var doc = new PDF();
		doc.pipe(fs.createWriteStream(path.resolve(__dirname + '/../public/certificados/document.pdf')));

		doc.text('HOLIDAYS - 125 Fortime',80,165,{align:'center'});
		doc.text('Hello this is a demo file',100,200);
		doc.image('./public/certificados/modelos/ex2.jpeg', 0, 15).text('Proportional to width', 0, 0);

		doc.end();
		res.sendFile(path.resolve(__dirname + '/../public/certificados/document.pdf'));
	}
	catch(e)
	{
		throw e;
	}
	
});

router.get('/teacher=:teacherName', function(req, res, next) {
	var teacherName = req.params.teacherName;

	try
	{
		treatKeywordsForTeacher(teacherName).then(function(cloud)
		{
			tagCloud.tagCloud(cloud, function (err, data) {
				res.render('teacherPage', { cloud: data } );
			}, {
				classPrefix: 'btn tag tag',
				randomize: false,
				numBuckets: 5,
				htmlTag: 'a',
				additionalAttributes: {href: vars.config.url +'/keyword={{tag}}'}
			});
		}).catch((err) => setImmediate(() => { throw err; }));
	}
	catch(err)
	{
		throw err;
	}
	
	function treatKeywordsForTeacher(teacherName)
	{
		try
		{
			var sql = "SELECT palavra AS keyword, COUNT(*) AS totalUsage FROM palavras_chave_publicacao PCP JOIN servidor_publica SP ON SP.codPublicacao = PCP.fk_codPublicacao JOIN servidor S ON S.siapeServidor = SP.siapeServidor WHERE S.nomeServidor = '" + teacherName + "' GROUP BY palavra";
			return new Promise(function(resolve, reject)
			{
				vars.con.query(sql, function (err, results, fields)
				{
					if(err)
					{
						return Promise.reject(err);
					}
					
					var cloud = [];
					results.forEach(function(result)
					{
						cloud.push({
							tagName: result["keyword"], count: result["totalUsage"]
						});
					});
					var sorted = sort.quicksort(cloud, (a, b) => b.count - a.count);
					resolve(sorted);
				});
			});
		}
		catch(err)
		{
			throw err;
		}
	}
});

router.get('/keyword=:word', function(req, res, next) {
	var keyword = req.params.word;
	proceeding.getProceedingCodeByKeyword(keyword).then(function(proceedingsCodes)
	{
		var promises = [];
		proceedingsCodes.forEach(function(proceedingCode)
		{
			const promise = proceeding.getProceedingInfo(proceedingCode);
			promises.push(promise);
		});

		Promise.all(promises).then(proceedings =>
		{
			res.render('keywordPage', { proceedingsByKeyword: proceedings, word: keyword } );
		});
	}).catch((err) => setImmediate(() => { throw err; }));;
});

router.post('/search', function(req, res, next) {
	var searchValue = req.body.searchValue;

	try
	{
		if(vars.con.state === 'disconnected')
		{
			vars.con.connect(function(err) {
				if (err) throw err;
			});
		}
		
		searchValue = '%' + searchValue + '%'; // Apenas escapa as aspas simples

		runQueries(searchValue).then(function(result)
		{
			teacherByName(searchValue).then(function(cloud)
			{
				tagCloud.tagCloud(cloud, function (err, data)
				{
					res.render('searchProceedings', { proceedingsByName: result[0][0], proceedingsByAuthor: result[1][0], proceedingsByStudents: result[2][0], cloud: data } );
				}, {
					classPrefix: 'btn tag tag',
					randomize: true,
					numBuckets: 5,
					htmlTag: 'a',
					additionalAttributes: {href: vars.config.url +'/teacher={{tag}}'}
				});
			}).catch((err) => setImmediate(() => { throw err; }));
		}).catch((err) => setImmediate(() => { throw err; }));
	}
	catch(err)
	{
		throw err;
	}

	function teacherByName(teacherName)
	{
		try
		{
			var sql = "SELECT nomeServidor AS teacherName FROM servidor WHERE nomeServidor LIKE '" + teacherName + "' AND tipo = 'DOCENTE'";
			return new Promise(function(resolve, reject)
			{
				vars.con.query(sql, function (err, results, fields)
				{
					var cloud = [];
					results.forEach(function(result)
					{
						cloud.push({
							tagName: result["teacherName"], count: 1
						});
					});
					resolve(cloud);
				});
			});
		}
		catch(err)
		{
			throw err;
		}
	}

	function runQueries(toSearchValue)
	{
		var treatedResults = [];
		var queryGetProceedingsByTitle = "SELECT codPublicacao AS proceedingCode FROM publicacao WHERE nomePublicacao LIKE '" + toSearchValue + "'";
		var queryGetProceedingsByTeachers = "SELECT P.codPublicacao AS proceedingCode, nomePublicacao AS proceedingName, URN_ArtigoCompleto AS proceedingPath, nomeServidor AS proceedingAuthor FROM publicacao P JOIN servidor_publica SP ON SP.codPublicacao = P.codPublicacao  JOIN servidor S ON S.siapeServidor = SP.siapeServidor WHERE S.nomeServidor LIKE '" + toSearchValue + "'";
		var queryGetProceedingsByStudents = "SELECT P.codPublicacao AS proceedingCode FROM publicacao P JOIN aluno_publica AP ON AP.codPublicacao = P.codPublicacao JOIN aluno A ON A.matriculaAluno = AP.matriculaAluno WHERE A.nomeAluno LIKE '" + toSearchValue + "'";	
		var sql = queryGetProceedingsByTitle + ";" + queryGetProceedingsByTeachers + ";" + queryGetProceedingsByStudents;

		try
		{
			return new Promise(function(resolve, reject)
			{
				vars.con.query(sql, [1, 2, 3], function (err, results, fields)
				{
					if(err)
					{
						return Promise.reject(err);
					}

					//Trata cada resultado obtido
					//Trata a busca por nome de publicação
					var proceedingsByName = [];
					var promises = [];
					results[0].forEach(function(result)
					{
						var proceedingCode = result["proceedingCode"];
						const promise = proceeding.getProceedingInfo(proceedingCode);
						promises.push(promise);
					});

					//Trata cada resultado obtido
					//Trata a busca por nome de autor
					Promise.all(promises).then(proceedings =>
					{
						proceedingsByName.push(proceedings);
						treatedResults.push(proceedingsByName);
						
						var proceedingsByAuthor = [];
						promises = [];
						results[1].forEach(function(result)
						{
							var proceedingCode = result["proceedingCode"];
							const promise = proceeding.getProceedingInfo(proceedingCode);
							promises.push(promise);
						});
						//Trata cada resultado obtido
						//Trata a busca por nome de aluno
						Promise.all(promises).then(proceeding =>
						{
							proceedingsByAuthor.push(proceeding);
							treatedResults.push(proceedingsByAuthor);

							var proceedingsByStudents = [];
							promises = [];
							results[2].forEach(function(result)
							{
								var proceedingCode = result["proceedingCode"];
								const promise = proceeding.getProceedingInfo(proceedingCode);
								promises.push(promise);
							});

							Promise.all(promises).then(proceeding =>
							{
								proceedingsByStudents.push(proceeding);
								treatedResults.push(proceedingsByStudents);
								resolve(treatedResults);
							});
						});
					});
				});
			});
		}
		catch(e)
		{
			throw e;
		}
	}	
});



router.get('/pub-discentes/compilados/2014-2016.pdf', function(req, res, next) {
	res.sendFile(path.resolve(__dirname + '/../public/publicacoes-discentes/compilados/2014-2016.pdf'), function(err, html) {
		if(err) {
			throw err;
		} else {
			if(!res.status(200))
			{
				res.send(html);
			}
		}
	});
});
module.exports = router;