import * as THREE from "three";

// Gameplay obscuration has identical density and geometry on every graphics preset.
export function smokeVolume() {
  const geometry = new THREE.SphereGeometry(1, 24, 16),
    material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        center: { value: new THREE.Vector3() },
        radius: { value: 4.6 },
        fade: { value: 1 },
        time: { value: 0 },
      },
      vertexShader: `varying vec3 world;void main(){vec4 p=modelMatrix*vec4(position,1.);world=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,
      // Uniform ten-sample integration; stop once opacity exceeds 99.9%.
      fragmentShader: `varying vec3 world;uniform vec3 center;uniform float radius;uniform float fade;uniform float time;void main(){vec3 ray=normalize(world-cameraPosition);vec3 origin=cameraPosition-center;float b=dot(origin,ray);float c=dot(origin,origin)-radius*radius;float discriminant=b*b-c;if(discriminant<0.)discard;float entry=max(0.,-b-sqrt(discriminant));float end=-b+sqrt(discriminant);float stepSize=(end-entry)/10.;float density=0.;for(int i=0;i<10;i++){vec3 p=origin+ray*(entry+(float(i)+.5)*stepSize);float radial=1.-length(p)/radius;float turbulence=.82+.18*sin(p.x*2.+time*.3)*sin(p.z*2.5-time*.2)*sin(p.y*2.);density+=smoothstep(0.,.35,radial)*turbulence*stepSize;if(density>4.5)break;}float alpha=(1.-exp(-density*1.55))*fade;gl_FragColor=vec4(mix(vec3(.61,.65,.61),vec3(.78,.8,.74),clamp(world.y-center.y,0.,radius)/radius),alpha);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>}`,
    });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 3;
  return mesh;
}
