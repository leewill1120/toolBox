#!/usr/bin/node
const http = require('http');
const process = require('process');
const fs = require('fs');

var cmd = process.argv[2];
var host = '127.0.0.1';
var port = '2375';
var url = `http://${host}:${port}`;
var configFile = 'containers.json';
var containersList = {};

switch(cmd){
	case 'get':
		getContainers();
		break;
	case 'create':
		createContainers();
		break;
	default:
		console.log(`not support cmd ${cmd}`);
		break;
}

function getContainers(){
	http.get(`${url}/containers/json?all=1`, (res) =>{
		var buf = '';
		res.resume().on('data', (data)=>{
			buf += `${data}`;
		}).on('end', ()=>{
			var containers = JSON.parse(buf);
			var containerNum = containers.length;
			var cnt = 0;
			for (var i = 0; i < containers.length; i++) {
				var containerName = containers[i].Names[0].split('/')[1];
				if(undefined != containerName){
					http.get(`${url}/containers/${containerName}/json`, (res) =>{
						var containerBuf = '';
						res.resume().on('data', (data)=>{
							containerBuf += `${data}`
						}).on('end', ()=>{
							var c = JSON.parse(containerBuf);
							var name = c.Name.replace('/', '');
							console.log(name);
							var shortId = c.Id.substr(0, 12);
							containersList[name] = {
								Id:shortId,
								Config:getArguments(c, `snapshot-${shortId}`)
							};
							cnt++;
							if(cnt == containerNum){
								fs.writeFile(configFile, JSON.stringify(containersList), function () {
									console.log('* * * written to containers.json * * *');
								})
							}
						});
					}).on('error', (e)=> {
						console.error(e.message);
						process.exit();
					});
				}else{
					console.error("ERROR to get containerName");
					process.exit();
				}
			}
		});
	}).on('error', (e)=> {
		console.error(e.message);
		process.exit();
	});
}

function createContainers(){
	fs.readFile(configFile, (err, data)=>{
		if(err){
			console.error(err.message);
		}else{
			containersList = JSON.parse(data);
			for(var c in containersList){
				var options = {
				  hostname: host,
				  port: port,
				  path: `/containers/create?name=${c}`,
				  method: 'POST',
				  headers: {
				    'Content-Type': 'application/json'
				  }
				};

				var req = http.request(options, (res) => {
				  var buf = '';
				  console.log(`STATUS: ${res.statusCode}`);
				  res.setEncoding('utf8');
				  res.on('data', (chunk) => {
				    buf += `${chunk}`;
				  });
				  res.on('end', () => {
				    if(201 == res.statusCode){
				    	console.log(`创建容器${c}成功,${buf}`);
				    	var ret = JSON.parse(`${buf}`);
				    	startContainer(ret.Id);
				    }else{
				    	console.log(`创建容器${c}失败,${buf}`);
				    }
				  });
				});

				req.on('error', (e) => {
				  console.log(`problem with request: ${e.message}`);
				});

				// write data to request body
				req.write(JSON.stringify(containersList[c].Config));
				req.end();
			}
		}
	});
}

function startContainer(c){
	var options = {
	  hostname: host,
	  port: port,
	  path: `/containers/${c}/start`,
	  method: 'POST',
	  headers: {
	    'Content-Type': 'application/json'
	  }
	};

	var buf = '';
	var req = http.request(options, (res) => {
	  console.log(`STATUS: ${res.statusCode}`);
	  res.setEncoding('utf8');
	  res.on('data', (chunk) => {
	    buf += `${chunk}`;
	  });
	  res.on('end', () => {
	    if(204  == res.statusCode){
	    	console.log(`启动容器${c}成功,${buf}`);

	    }else{
	    	console.log(`启动容器${c}失败,${buf}`);
	    }
	  });
	});

	req.on('error', (e) => {
	  console.log(`problem with request: ${e.message}`);
	});

	req.end();
}

function getArguments(data, image){
	var ret = {
		'Hostname': data.Config.Hostname,
		'Domainname': data.Config.Domainname,
		'User': data.Config.User,
		'AttachStdin': data.Config.AttachStdin,
		'AttachStdout': data.Config.AttachStdout,
		'AttachStderr': data.Config.AttachStderr,
		'Tty': data.Config.Tty,
		'OpenStdin': data.Config.OpenStdin,
		'StdinOnce': data.Config.StdinOnce,
		'Env': data.Config.Env,
		'Cmd': data.Config.Cmd,
		'Entrypoint': data.Config.Entrypoint,
		'Image': image,
		'Labels': data.Config.Labels,
		'Volumes': data.Config.Volumes,
		'WorkingDir': data.Config.WorkingDir,
		'ExposedPorts': data.Config.ExposedPorts,
		'StopSignal': data.Config.StopSignal,
		'HostConfig':{
			'Binds': data.HostConfig.Binds,
			'Links': data.HostConfig.Links,
			'PortBindings': data.HostConfig.PortBindings,
			'PublishAllPorts': data.HostConfig.PublishAllPorts,
			'Privileged': data.HostConfig.Privileged,
			'Dns': data.HostConfig.Dns,
			'DnsOptions': data.HostConfig.DnsOptions,
			'DnsSearch': data.HostConfig.DnsSearch,
			'VolumesFrom': data.HostConfig.VolumesFrom,
			'RestartPolicy': data.HostConfig.RestartPolicy,
			'NetworkMode': data.HostConfig.NetworkMode,
			'Devices': data.HostConfig.Devices,
			'Ulimits': data.HostConfig.Ulimits,
			'LogConfig': data.HostConfig.LogConfig,
			'SecurityOpt': data.HostConfig.SecurityOpt,
			'VolumeDriver': data.HostConfig.VolumeDriver
		}
	};
	if(undefined == ret.HostConfig.Binds || null == ret.HostConfig.Binds){
		ret.HostConfig.Binds = [];
	}
	for (var i = 0; i < data.Mounts.length; i++) {
		if(!destinationExist(ret.HostConfig.Binds, data.Mounts[i].Destination)){
			if(undefined == data.Mounts[i].Name ){
				ret.HostConfig.Binds.push(`${data.Mounts[i].Source}:${data.Mounts[i].Destination}`);
			}else{
				ret.HostConfig.Binds.push(`${data.Mounts[i].Name}:${data.Mounts[i].Destination}`);
			}			
		}

	}
	return ret;
}

function destinationExist(Binds, dest){ //Binds = ["/tmp:/tmp", "/root/ok:/data"]
	for (var i = 0; i < Binds.length; i++) {
			if( 2 != Binds[i].split(':').length){
				console.error("Bind format unknow");
				process.exit();
			}else{
				var mydest = Binds[i].split(':')[1];
				if(mydest.trim() == dest.trim()){
					return true;
				}
			}
	}
	return false;	
}