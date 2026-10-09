# NYMERIA — permanent project vision

This document is a permanent constraint for future sprints, not a feature checklist
for Sprint 2.2. Consult it before architecture, graphics or gameplay changes.

**NYMERIA is an illustrated fantasy 2D mobile RPG, centered on avatar customization,
visibly equipped gear, deep progression and social/cooperative play.** Smartphone
portrait is the primary format; low hardware requirements and simple touch controls
support complex player decisions. Exploration uses illustrated places, screens,
choices and contextual interactions, not free movement through a 3D world.

## Personal identity and visible equipment

Avatar customization, equipment visuals and cooperative/social systems are pillars,
not optional decorative extras. The evolving avatar system must support physical
appearance, hair, aesthetic variants, visible armor, weapons and accessories,
coordinated sets and purely cosmetic choices. Players must eventually see their
own avatar and those of other players, with a coherent identity.

A supported visual slot changes its own graphical part when equipped: helmets
change the head overlay, armor the torso, gloves/boots their respective parts,
weapons their visible weapon. Sets build up across independently equipped pieces.
Do not require a complete new character illustration for every item combination.

Preserve and evolve the modular renderer: layered assets, explicit rendering order,
equipment-to-visual mapping, slot/part compatibility, interchangeable assets and
appearance variants. Use consistent composition in Hero, Equipment and future
social/profile screens. Keep Character Appearance separate from equipment appearance
and glamour. Approved character artwork is frozen until explicitly authorized;
technical packaging does not authorize redesigning it.

Smithing Master is a reference for the **function** of visible equipment customization,
not an artwork source. Do not copy graphics or protected content from any game.

## Depth, cooperation and original direction

Conceptual inspirations are OGame's simplicity of interaction/management, World of
Warcraft's depth of classes/equipment/progression and large MMORPGs' professions,
cooperation and social activities. These references do not authorize copied layouts,
assets, characters, content or a complex 3D control scheme.

Future social scope includes real player guilds, public profiles and avatars,
dungeon/boss groups, coherent tank/DPS/healer roles, chat, guild activities, shared
progression/cooperation and a game economy. Future multiplayer needs a dedicated
backend. Local demo members are not real multiplayer. Sprint 2.2 implements none
of these systems and must not lock out their later architecture.

## Permanent art direction

Final art is original, illustrated, painterly and fantasy. Interface screens evoke
places or objects of the world: quests as an illustrated old journal; the map as
an interactive fantasy chart; guilds as an adventurers' tavern/headquarters; smithing
as a forge; herbalism as a plant/tool laboratory; inventory as an adventurer's bag
or equipment. Integrate UI into the world instead of adding excessive ornamental
frames, flourishes or visual noise. Animations are few, lightweight and functional:
small flame, particle, page or environmental movements. Respect reduced motion.
Sprint 2.2 preserves current art and does not implement this future art overhaul.

## Product and creator workflow

The creator works mainly from iPhone: proposes ideas and tests the game; ChatGPT
helps with design, balancing, art direction/specifications; Codex implements;
GitHub hosts repositories, tests and builds; the creator checks browser previews
and later installable builds. Routine development must not require the creator to
use a computer. Native signing, distribution and device installation have platform
requirements; document them honestly rather than pretending an unsigned build can
be installed on iPhone.

HTML/CSS/JavaScript with Capacitor is the chosen mobile foundation. Do not migrate
to Unity, Godot, React Native or another engine/framework without a new explicit
design decision. Simple controls and minimal motion must coexist with deep systems.
Browser previews remain useful, but native UI/assets are bundled locally and do
not load the interface from GitHub Pages. Local saves are not future online accounts.
