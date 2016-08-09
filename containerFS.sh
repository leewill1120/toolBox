#!/bin/bash
if [ "$1" = "export" ];then
	for c in `docker ps -aq`
	do
		name=$(docker inspect -f {{.Name}} $c)
		name=${name:1}
		echo "export ${name}..."
		docker export -o snapshot-${c}.tar $c
	done
fi

if [ "$1" = "import" ];then
	for t in `ls *.tar`
	do
		name=$(echo $t | awk -F. '{print $1}')
		echo "import ${name}..."
		docker import $t ${name}
	done
fi
