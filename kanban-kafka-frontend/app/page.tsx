import KanbanBoard from './components/KanbanBoard';

export default function Home() {
  return (
    <main>
      <h1 className="text-3xl font-bold text-center mt-8">Kafka Collaborative Board</h1>
      <KanbanBoard />
    </main>
  );
}