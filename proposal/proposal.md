# School of Computing

## CA326 Year 3 Project Proposal Form

### SECTION A

**Project Title:** 3D Modeling and Rendering Web Application  
**Student 1 Name:** Eoghan Brennan  **ID Number:** 23380443  
**Student 2 Name:** Sum Wai Tsang  **ID Number:** 23500156  
**Staff Member Consulted:** Professor Mark Humphrys

---

## Table of Contents

1. [Project Description](#project-description)  
     1.1 [Introduction](#11-introduction)  
     1.2 [Problem](#12-problem)  
     1.3 [Solution (ZenCG)](#13-solution-zencg)  
     1.4 [ZenCG Features](#14-zencg-features)  
      - Viewport  
      - Workspace GUI  
      - Modelling  
      - Lighting  
      - Materials & Textures  
      - Rendering  
      - Additional Features  
     1.5 [Overview](#15-overview)
    
2. [Division of Work](#2-division-of-work)
    
3. [Programming Language(s)](#3-programming-languages)
    
4. [Programming Tool(s)](#4-programming-tools)
    
5. [Learning Challenges](#5-learning-challenges)
    
6. [Hardware / Software Platform](#6-hardware--software-platform)
    
7. [Special Hardware / Software Requirements](#7-special-hardware--software-requirements)
    

---

## 1. Project Description

### 1.1 Introduction

Our aim is to create a lightweight 3D modelling and rendering web application that can be used without intensive resources. For simplicity, the aforementioned term will be interchangeable with 3D computer graphics, 3D creation tools, and will be referred to as **ZenCG**.

What it will **not** be is a computer-aided design (CAD) software, as the intended purpose for this app is not for precise product design, but rather creative and visual design—much like Blender, a popular open-source 3D creation software.

However, ZenCG will be **web-based, lightweight, and intuitively designed**. It will be less complex than industry standards like Blender and Maya but will make up for it in usability, functionality, and performance.

Our intended market and ideal users are those interested or already established in the 3D computer graphics industry who do not have access to high-specification systems.

---

### 1.2 Problem

Our application addresses a real problem. Why should beginners who want to create three-dimensional models and renders rely on system-demanding applications like Blender or Maya?

Not to mention, there is a steep learning curve in those applications and they are not very intuitive to use. Our aim is to find the intersection between **performance**, **quality**, and **usability**.

---

### 1.3 Solution (ZenCG)

The solution is to create a lightweight web-based application that does not compromise on performance or quality, whilst being truly usable—a _zen_ application—intuitive to use, without the overwhelming complex interface that most beginners are confronted with when learning Blender or Maya.

---

### 1.4 ZenCG Features

ZenCG shall contain the essential features of a 3D modelling and rendering application. We acknowledge that we may not be able to implement a full-fledged, feature-packed system, but that also plays into the core premise of our application: **simplicity and usability**.

Below is a broad overview of the features we intend to add.

#### Viewport

- The viewport shall use the Cartesian coordinate system (X, Y, Z axis).
    
- The user shall be able to pan, zoom, and focus on selected objects.
    
- The user shall be able to see all angles of an object (top, left, right, bottom) using the X, Y, Z, -X, -Y, -Z axes.
    

#### Workspace GUI

- The application shall have an intuitive GUI that is user-friendly and simple to interact with.
    
- The GUI shall be uncomplicated and clear. Users shall be able to toggle the GUI.
    
- The user shall be able to export and import files into the 3D environment.
    

#### Modelling

- The user shall be able to create, edit, and delete 3D models in real-time.
    
- The 3D models shall be defined using faces, edges, and vertices.
    
- The 3D models shall be described using the X, Y, Z axis dimensions.
    

#### Lighting

- The user shall be able to add different lights onto the scene: a point light, area light, or a 3D object that emits light (emission).
    

#### Materials & Textures

- The user shall be able to apply any colour on a 3D object.
    
- The user shall be able to apply image textures on a 3D object.
    
- The user shall be able to apply material textures on a 3D object.
    

#### Rendering

- The user shall be able to render their final scene with realistic lighting, shading, and other effects.
    

#### Additional Features

We aim to create a simple application without too many complicated features.  
There are features we will **not** add, such as:

- Sculpting (moulding 3D meshes like clay)
    
- Different viewport options (wireframes, models only, texturised models, live render view)
    

---

### 1.5 Overview

We are to create a web-based 3D modelling and rendering application named **ZenCG**.  
It shall prioritise performance and usability without compromising too much on quality.  
The program will contain most of the essential features expected from a computer graphics application.

---

## 2. Division of Work

We have divided the project evenly amongst ourselves. It is subject to change during development—if our project proposal is accepted.

Below is a rough outline of how we envisage our work will be split.  
Eoghan Brennan (23380443) will work on the **3D engine**, whilst Sum Wai Tsang (23500156) will work on the **full-stack development**.

Naturally, as team members, we will assist each other in our tasks, but for efficiency and collaboration, we will divide work equally and regularly check in on each other throughout the workday.

| Area                                      | Eoghan Brennan | Sum Wai Tsang |
| ----------------------------------------- | -------------- | ------------- |
| 3D Engine                                 | ✓              |               |
| GUI — UI/UX                               |                | ✓             |
| Object Manipulation (Move, Scale, Rotate) | ✓              | ✓             |
| Camera Controls                           | ✓              |               |
| Frontend Integration (React + WebGL)      |                | ✓             |
| File Import/Export (OBJ, glTF)            | ✓              | ✓             |
| Rendering Optimization                    | ✓              |               |
| CSS/Tailwind                              |                | ✓             |
| Testing (3D Engine)                       | ✓              | ✓             |

---

## 3. Programming Language(s)

- **JavaScript** (displays graphics through WebGL)
    
- **HTML** (provides structure of web application)
    
- **CSS** (styles user interface)
    

---

## 4. Programming Tool(s)

- **Code Editor:** VSCode
    
- **Web Browser:** Google Chrome
    
- **Development Server / Build Tools:** Node.js, npm
    
- **Frontend:** React.js
    
- **Backend:** Django
    
- **Styling:** Tailwind CSS
    
- **Graphics Tools:** WebGL, GLSL (for shading)
    
- **Collaboration Tools:** GitLab
    
- **Graphics API:** OpenGL ES 2.0 (for preview)
    
- **Rendering:** Custom CPU Ray Tracer
    
- **UI:** Dear ImGui / Qt Lite
    
- **File Formats:** OBJ, glTF
    
- **Tailwind CSS:** Styling
    

---

## 5. Learning Challenges

- We are not too knowledgeable in JavaScript, so learning it during production may be a challenge.
    
- Understanding 3D programming through WebGL is a new territory for us.
    
- Handling mouse and keyboard movements may be a challenge.
    
- This is our first large project, so structuring it correctly—especially debugging—may be difficult.
    
- Optimising performance could be a struggle.
    

---

## 6. Hardware / Software Platform

**Web Browser**  
Must support WebGL 1.0+, JavaScript ES6+, and HTML5.

**Compatible Browsers include:**

- Google Chrome
    
- Mozilla Firefox
    
- Microsoft Edge
    

---

## 7. Special Hardware / Software Requirements

### Minimum Requirements (for basic functionality)

- **CPU:** Any modern dual-core processor (e.g., Intel i3 or equivalent)
    
- **GPU:** Integrated graphics with WebGL support (e.g., Intel HD Graphics, AMD Vega, or older NVIDIA GPUs)
    
- **RAM:** 4 GB
    
- **Display:** 1280×720 resolution
    
- **Input Devices:** Mouse and keyboard