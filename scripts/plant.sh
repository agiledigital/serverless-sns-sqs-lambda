#!/bin/bash
for D in `ls  ./plant-uml-files/**.plant`
 do
     echo 'generating' $D
     plantuml $D
 done
