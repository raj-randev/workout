import { EXERCISES, getExerciseDemoLink } from '../data/exercises';

export function FormPage() {
  const exerciseNames = Object.keys(EXERCISES);

  return (
    <section className="section-card">
      <header>
        <p className="eyebrow">Form reference</p>
        <h2>Exercise cue cards</h2>
      </header>

      <div className="exercise-grid">
        {exerciseNames.map((name) => {
          const item = EXERCISES[name];
          return (
            <article className="exercise-card" key={name}>
              <header>
                <div>
                  <h3>{name}</h3>
                  <p style={{ margin: '6px 0 0', color: '#6a7180' }}>{item.muscle}</p>
                </div>
                <a href={getExerciseDemoLink(name) ?? '#'} target="_blank" rel="noreferrer" className="badge custom">
                  Watch demo
                </a>
              </header>
              <div className="card-body">
                <p>
                  <strong>Set up:</strong> {item.set}
                </p>
                <p>
                  <strong>Move:</strong> {item.mv}
                </p>
                <p>
                  <strong>Avoid:</strong> {item.av}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
