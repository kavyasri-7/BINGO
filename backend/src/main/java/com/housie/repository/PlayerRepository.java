package com.housie.repository;

import com.housie.model.Player;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface PlayerRepository extends JpaRepository<Player, Long> {
    List<Player> findByRoomCode(String roomCode);
    Optional<Player> findByRoomCodeAndUserUid(String roomCode, String userUid);
    long countByRoomCode(String roomCode);
}
