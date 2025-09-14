import { useAuth } from '@/lib/auth';

export default function HomePage() {
  const auth = useAuth();

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex-1 p-6">
        <div className="text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">
              Добро пожаловать в StudChat
            </h1>
            <p className="text-muted-foreground">
              Анонимная студенческая социальная сеть
            </p>
          </div>
          
          {auth.user && (
            <div className="bg-card rounded-lg p-4 border border-border">
              <h2 className="text-lg font-semibold mb-2 text-foreground">
                Ваш анонимный профиль
              </h2>
              <p className="text-sm text-muted-foreground mb-1">
                Имя в чате: <span className="font-medium text-foreground">{auth.user.anonName}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                ID: {auth.user.id}
              </p>
            </div>
          )}
          
          <div className="space-y-4">
            <div className="bg-card rounded-lg p-4 border border-border text-left">
              <h3 className="font-semibold mb-2 text-foreground">📝 Особенности</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Анонимные чаты для студентов</li>
                <li>• Безопасное общение без раскрытия личности</li>
                <li>• Модерация контента</li>
                <li>• Профили с образовательной информацией</li>
              </ul>
            </div>
            
            <div className="bg-card rounded-lg p-4 border border-border text-left">
              <h3 className="font-semibold mb-2 text-foreground">🔒 Приватность</h3>
              <p className="text-sm text-muted-foreground">
                Ваша настоящая личность защищена. В чатах отображается только ваше анонимное имя.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}