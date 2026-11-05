# SPEC-000: LibraryFlow — Foundation

## 1. Purpose

Define the initial technical and organizational foundation for LibraryFlow, establishing project structure, technology restrictions, naming conventions, Git conventions, and the initial Definition of Done.

This specification provides a consistent baseline for incremental development. It does not define functional user stories, detailed business rules, or implementation code.

## 2. Scope / Reach

LibraryFlow is a lightweight web application intended for readers and publishers who need to share, discover, and discuss books through a simple interface.

The initial product objective is to centralize book information and facilitate book discovery and discussion without the complexity of a comprehensive publishing platform.

The initial MVP scope includes the following capabilities:

* Share books.
* Visualize available books.
* Search and filter books.
* Discuss books.
* Persist relevant information between sessions.

Development will follow an incremental approach. Each subsequent specification or implementation task must address only the explicitly requested objective.

Functional user stories, detailed acceptance criteria, and individual feature specifications are defined separately in the product documentation.

## 3. Initial Project Structure

The project will use `src/` as the root directory for application source files.

Initial proposed structure:
Web: frontend
Api:backend
Directory and file responsibilities:

To be defined.

The structure may be extended incrementally when justified by an approved requirement.

## 4. Technical Restrictions

* Must use Firebase products for authentication, database, and hosting.
* Must be deployable with render + netlify for the frontend and backend.
* RESTful API must be implemented for the backend.

### 4.1. Required Technologies

* HTML5 for document structure.
* CSS3 for presentation and layout.
* JavaScript using native ES modules.
* localStorage for client-side persistence where applicable.
* Git for version control.
* Visual Studio Code as the development environment.
* Tailwind CSS for styling, loaded through the CDN for Sprint 1.
* Reusing from last project, subject to immediate modification
* React for the frontend.
* Vite for the frontend build system and backend connection.
* Node.js for the backend runtime environment.
* typescript for type safety and code clarity.

### 4.2. Prohibited Technologies
* None as of yet.

### 4.3. Execution Environment

The application must be executable locally from Visual Studio Code or another console with the capabilities.

The application must not depend on external services for its core functionality, but it must be able to switch between local and deployment configurations

### 4.4. Persistence

Information and files must be stored in the browser's localStorage/database.

Persistence requirements:

* Task data must remain available after page reloads within the 
* Functional user stories and detailed acceptance criteria.
* Task registration, visualization, and update implementation details.
* Detailed task data models and validation rules.
* Task deletion.
* Task search and filtering.
* Task assignment to team members.
* Authentication and authorization.
* User accounts and profiles.
* Backend services, APIs, and databases.
* Cloud storage and cross-device synchronization.
* Real-time collaboration.
* Notifications and reminders.
* Reporting, analytics, and dashboards.
* External integrations.
* Automated deployment and hosting.
* Frontend frameworks other than Tailwind CSS; unapproved libraries, build systems, and bundlers.
* Comprehensive automated testing infrastructure.
same browser origin.
* Changes to tasks must be reflected in persistent storage.
* Data must be read from localStorage when the application initializes.
* Invalid or missing stored data must not cause unhandled application errors.

Data synchronization between browsers, devices, or users is not included in this foundation.

## 5. Naming Conventions

### 5.1. Files and Directories

* Use lowercase names for files and directories.
* Use kebab-case for multiword file and directory names.
* Use descriptive names that communicate purpose.
* Use `.html`, `.css`, `.js`, `.tsx`, `.ts`, and `.md` extensions for their respective file types.

Examples:

* `index.html`
* `styles.css`
* `main.js`
* `task-form.js`
* `SPEC-000-foundation.md`

### 5.2. JavaScript

* Use camelCase for variables and functions.
* Use PascalCase only when naming classes, if classes become necessary.
* Use UPPER_SNAKE_CASE for genuine constants representing fixed configuration values.
* Prefer descriptive names over abbreviations.
* Use ES module `import` and `export` statements when sharing functionality between modules.
* Prefer `const` by default and use `let` when reassignment is necessary.
* Avoid global variables and implicit dependencies between modules.

### 5.3. CSS

* Use kebab-case for CSS class names and custom properties.
* Prefer descriptive class names based on component purpose or presentation.
* Avoid unnecessary ID selectors for styling.
* Keep presentation rules separate from JavaScript behavior.

### 5.4. HTML

* Use semantic HTML5 elements where appropriate.
* Use lowercase element and attribute names.
* Provide meaningful labels for form controls.
* Maintain a logical heading hierarchy.
* Use accessible text alternatives for meaningful images.

### 5.6 TSX 
* to be defined

### 5.7 TS 
* to be defined

## 6. Git Conventions

### 6.1. Repository

The project must be tracked using Git from its initial development stage.

Changes must be committed incrementally, keeping each commit focused on a coherent modification.

### 6.2. Commit Messages

Use the Conventional Commits format:

`<type>(<scope>): <description>`

Allowed initial commit types:

* `feat`: New functionality.
* `fix`: Bug fixes.
* `docs`: Documentation changes.
* `style`: Formatting or presentation changes that do not alter application logic.
* `refactor`: Code restructuring without changing intended behavior.
* `test`: Test-related changes.
* `chore`: Maintenance and project configuration.

Examples:

* `docs(spec): define project foundation`
* `feat(tasks): add task registration`
* `fix(storage): handle invalid stored data`

Commit descriptions should be concise, imperative, and specific.

### 6.3. Change Management

* Do not commit generated files or temporary development artifacts unless explicitly required.
* Do not include unrelated changes in the same commit.
* Keep specifications and implementation aligned.
* Do not claim a change has been tested unless the corresponding verification has actually been performed.

Branching strategies, pull request requirements, and release conventions are not mandatory at this stage.

## 7. Initial Technical Definition of Done

A technical change is considered complete when all applicable criteria below are satisfied:

1. **Scope compliance:** The implementation addresses only the requested objective.
2. **Structure compliance:** Files are located within the established project structure, using `src/` for application source files.
3. **Technology compliance:** The implementation uses the approved native technologies without unauthorized frameworks, backends, or dependencies.
4. **Code organization:** HTML, CSS, and JavaScript responsibilities remain appropriately separated.
5. **Naming compliance:** New files, variables, functions, and CSS classes follow the defined naming conventions.
6. **Execution:** The application can be opened and executed locally in the intended development environment.
7. **Persistence:** When task data is affected, localStorage behavior is verified, including persistence after a page reload.
8. **Verification transparency:** Verification steps and actual results are documented accurately; unexecuted tests are explicitly identified as unexecuted.
9. **Documentation:** Relevant specifications or execution instructions are updated when the change affects them.
10. **Change isolation:** No unrelated functionality, files, or requirements are introduced.

Only the criteria applicable to a particular change must be verified. This foundation does not require a separate automated testing framework.

## 8. Outside of Scope / Reach

The following items are explicitly excluded from this foundation and must not be implemented without a subsequent approved specification:
* to be defined
The exclusions above define the current foundation boundary. Future capabilities may be considered through separate specifications without expanding the current scope implicitly.

## 9. Incremental Development Principle

LibraryFlow will be developed through small, verifiable increments.

Each new objective must:

1. Identify the intended change.
2. Clarify ambiguities before implementation.
3. Respect this foundation and the approved product goal.
4. Modify only the necessary files.
5. Include explicit verification instructions.
6. Avoid introducing unrequested requirements.

This specification establishes the initial project baseline and remains subject to controlled updates as the project evolves.
